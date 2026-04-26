'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Card from 'components/card/Card';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Skeleton,
  Text,
  Textarea,
  useColorModeValue,
} from 'lib/chakra';
import {
  loadTenantProfile,
  updateTenantProfile,
  uploadTenantProfileDocument,
} from 'lib/tenant/profileClient';
import { TenantProfileData, TenantProfileDocumentType } from 'lib/tenant/profile';

type ProfileFormState = {
  fullName: string;
  phone: string;
  preferredAreas: string;
  aboutMe: string;
};

function toFormState(profile: TenantProfileData): ProfileFormState {
  return {
    fullName: profile.user.fullName ?? '',
    phone: profile.user.phone ?? '',
    preferredAreas: profile.profile.preferredAreas.join(', '),
    aboutMe: profile.profile.aboutMe ?? '',
  };
}

export default function ProfileOverviewClient() {
  const { showNotice } = useGlobalNotice();
  const [profile, setProfile] = useState<TenantProfileData | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>({
    fullName: '',
    phone: '',
    preferredAreas: '',
    aboutMe: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingDocuments, setUploadingDocuments] = useState<
    Partial<Record<TenantProfileDocumentType, boolean>>
  >({});

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const barTrack = useColorModeValue('secondaryGray.200', 'whiteAlpha.200');
  const barFill = useColorModeValue('brand.500', 'brand.300');
  const inputBg = useColorModeValue('white', 'navy.700');
  const inputBorder = useColorModeValue('secondaryGray.300', 'whiteAlpha.300');
  const inputFocusBorder = useColorModeValue('brand.500', 'brand.300');
  const saveButtonBg = useColorModeValue('brand.500', 'brand.300');
  const saveButtonHoverBg = useColorModeValue('brand.600', 'brand.400');

  const refreshProfile = useCallback(
    async (loadingMode: 'initial' | 'refresh' = 'refresh') => {
      if (loadingMode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const result = await loadTenantProfile();
        if (!result.ok || !result.data) {
          throw new Error(result.message || 'Failed to load profile.');
        }

        setProfile(result.data);
        setFormState(toFormState(result.data));
        setLoadError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load profile.';
        setLoadError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refreshProfile('initial');
  }, [refreshProfile]);

  const totalCompletion = useMemo(() => {
    return profile?.completion.total ?? 0;
  }, [profile]);

  const handleEdit = () => {
    if (!profile) {
      return;
    }

    setFormState(toFormState(profile));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (profile) {
      setFormState(toFormState(profile));
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!profile) {
      return;
    }

    setIsSaving(true);
    try {
      const preferredAreas = formState.preferredAreas
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const result = await updateTenantProfile({
        fullName: formState.fullName.trim() ? formState.fullName.trim() : null,
        phone: formState.phone.trim() ? formState.phone.trim() : null,
        preferredAreas,
        aboutMe: formState.aboutMe.trim() ? formState.aboutMe.trim() : null,
      });

      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to update profile.');
      }

      setProfile(result.data);
      setFormState(toFormState(result.data));
      setIsEditing(false);
      showNotice({ type: 'success', message: result.message || 'Profile updated successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile.';
      showNotice({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocumentFileSelected = async (
    documentType: TenantProfileDocumentType,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    setUploadingDocuments((current) => ({
      ...current,
      [documentType]: true,
    }));

    try {
      const result = await uploadTenantProfileDocument({
        documentType,
        file: selectedFile,
      });

      if (!result.ok) {
        throw new Error(result.message || 'Failed to upload document.');
      }

      showNotice({
        type: 'success',
        message: result.message || `${selectedFile.name} uploaded. Status is pending review.`,
      });

      await refreshProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload document.';
      showNotice({ type: 'error', message });
    } finally {
      setUploadingDocuments((current) => ({
        ...current,
        [documentType]: false,
      }));
    }
  };

  const renderDocumentAction = (
    item: { uploaded: boolean; verified: boolean; type: TenantProfileDocumentType },
  ) => {
    if (item.verified) {
      return (
        <Text color="green.500" fontSize="lg" fontWeight="700" lineHeight="1">
          ✓
        </Text>
      );
    }

    if (item.uploaded) {
      return (
        <Text color={textSecondary} fontSize="sm" fontWeight="600">
          Pending
        </Text>
      );
    }

    return (
      <Button
        as="label"
        size="xs"
        cursor="pointer"
        loading={Boolean(uploadingDocuments[item.type])}
        disabled={Boolean(uploadingDocuments[item.type])}
        bg={saveButtonBg}
        color="white"
        _hover={{ bg: saveButtonHoverBg }}
        _active={{ bg: saveButtonHoverBg }}
      >
        {uploadingDocuments[item.type] ? 'Uploading...' : 'Upload'}
        <Input
          type="file"
          hidden
          accept=".jpg,.jpeg,.png,.webp"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            void handleDocumentFileSelected(item.type, event)
          }
        />
      </Button>
    );
  };

  if (isLoading) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Skeleton h="36px" mb="12px" borderRadius="10px" />
        <Skeleton h="90px" mb="16px" borderRadius="16px" />
        <Skeleton h="220px" borderRadius="16px" />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="16px" bg={panelBg}>
          <Text color={textPrimary} fontWeight="700" mb="8px">
            Unable to load profile
          </Text>
          <Text color={textSecondary} fontSize="sm" mb="12px">
            {loadError || 'Please refresh and try again.'}
          </Text>
          <Button size="sm" onClick={() => void refreshProfile()}>
            Retry
          </Button>
        </Card>
      </Box>
    );
  }

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Box mb="16px">
        <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
          Profile
        </Text>
        <Text fontSize="sm" color={textSecondary}>
          Manage verification and profile completeness for rental applications.
        </Text>
      </Box>

      <Card p="16px" bg={panelBg}>
        <Flex justify="space-between" align="center" mb="10px">
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            Tenant Details
          </Text>
          {!isEditing ? (
            <Button
              size="sm"
              onClick={handleEdit}
              bg={saveButtonBg}
              color="white"
              _hover={{ bg: saveButtonHoverBg }}
              _active={{ bg: saveButtonHoverBg }}
            >
              Edit Profile
            </Button>
          ) : null}
        </Flex>

        {!isEditing ? (
          <>
            <Text fontSize="sm" color={textSecondary} mb="6px">
              Name: {profile.user.fullName || '-'}
            </Text>
            <Text fontSize="sm" color={textSecondary} mb="6px">
              Email: {profile.user.email}
            </Text>
            <Text fontSize="sm" color={textSecondary} mb="6px">
              Phone: {profile.user.phone || '-'}
            </Text>
            <Text fontSize="sm" color={textSecondary} mb="6px">
              Preferred area:{' '}
              {profile.profile.preferredAreas.length > 0 ? profile.profile.preferredAreas.join(' / ') : '-'}
            </Text>
            <Text fontSize="sm" color={textSecondary}>
              About me: {profile.profile.aboutMe || '-'}
            </Text>
          </>
        ) : (
          <Box>
            <FormControl mb="10px">
              <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                Full Name
              </FormLabel>
              <Input
                value={formState.fullName}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFormState((current) => ({ ...current, fullName: event.target.value }))
                }
                bg={inputBg}
                border="1px solid"
                borderColor={inputBorder}
                _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
              />
            </FormControl>

            <FormControl mb="10px">
              <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                Phone
              </FormLabel>
              <Input
                value={formState.phone}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFormState((current) => ({ ...current, phone: event.target.value }))
                }
                bg={inputBg}
                border="1px solid"
                borderColor={inputBorder}
                _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
              />
            </FormControl>

            <FormControl mb="10px">
              <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                Preferred Areas (comma separated)
              </FormLabel>
              <Input
                value={formState.preferredAreas}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFormState((current) => ({ ...current, preferredAreas: event.target.value }))
                }
                bg={inputBg}
                border="1px solid"
                borderColor={inputBorder}
                _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
              />
            </FormControl>

            <FormControl mb="12px">
              <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                About Me
              </FormLabel>
              <Textarea
                value={formState.aboutMe}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setFormState((current) => ({ ...current, aboutMe: event.target.value }))
                }
                rows={4}
                bg={inputBg}
                border="1px solid"
                borderColor={inputBorder}
                _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
              />
            </FormControl>

            <Flex gap="8px">
              <Button
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                bg={saveButtonBg}
                color="white"
                _hover={{ bg: saveButtonHoverBg }}
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </Button>
            </Flex>
          </Box>
        )}
      </Card>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap="16px" mt="16px">
        <Card p="0" bg={panelBg}>
          <Box px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Flex justify="space-between" align="center" mb="8px">
              <Text fontWeight="700" color={textPrimary}>
                Required Identity Documents
              </Text>
              <Badge colorScheme={totalCompletion >= 70 ? 'green' : 'yellow'}>{totalCompletion}%</Badge>
            </Flex>
            <Text fontSize="xs" color={textSecondary} mb="8px">
              Required ID verification contributes 50%. Optional documents improve trust and ranking.
            </Text>
            <Box h="8px" borderRadius="999px" bg={barTrack} overflow="hidden">
              <Box h="100%" w={`${totalCompletion}%`} bg={barFill} />
            </Box>
            <Flex mt="8px" justify="space-between">
              <Text fontSize="xs" color={textSecondary}>
                Required: {profile.completion.requiredCompleted}%
              </Text>
              <Text fontSize="xs" color={textSecondary}>
                Optional: {profile.completion.optionalCompleted}%
              </Text>
            </Flex>
          </Box>
          {profile.requiredDocuments.map((item) => (
            <Flex
              key={item.id}
              px="16px"
              py="12px"
              borderBottom="1px solid"
              borderColor={borderColor}
              justify="space-between"
              align="center"
            >
              <Text color={textPrimary} fontSize="sm">
                {item.label}
              </Text>
              {renderDocumentAction(item)}
            </Flex>
          ))}
        </Card>

        <Card p="0" bg={panelBg}>
          <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Text fontWeight="700" color={textPrimary}>
              Optional Trust Documents
            </Text>
          </Flex>
          {profile.optionalDocuments.map((item) => (
            <Flex
              key={item.id}
              px="16px"
              py="12px"
              borderBottom="1px solid"
              borderColor={borderColor}
              justify="space-between"
              align="center"
            >
              <Box>
                <Text color={textPrimary} fontSize="sm">
                  {item.label}
                </Text>
                <Text color={textSecondary} fontSize="xs">
                  Weight: {item.weight}%
                </Text>
              </Box>
              {renderDocumentAction(item)}
            </Flex>
          ))}
        </Card>
      </Grid>

      {loadError ? (
        <Flex mt="12px" justify="space-between" align="center" gap="8px" wrap="wrap">
          <Text color={textSecondary} fontSize="xs">
            {loadError}
          </Text>
          <Button size="xs" variant="outline" onClick={() => void refreshProfile()} loading={isRefreshing}>
            Refresh
          </Button>
        </Flex>
      ) : null}
    </Box>
  );
}
