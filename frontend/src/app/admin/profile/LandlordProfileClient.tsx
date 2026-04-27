'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Card from 'components/card/Card';
import { useGlobalNotice } from 'components/feedback/GlobalNoticeProvider';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Skeleton,
  Text,
  useColorModeValue,
} from 'lib/chakra';
import { loadLandlordProfile, updateLandlordProfile } from 'lib/landlord/profileClient';
import { LandlordProfileData } from 'lib/landlord/profile';

type LandlordProfileFormState = {
  fullName: string;
  phone: string;
  agencyName: string;
  licenseNumber: string;
  portfolioSize: string;
  verificationStatus: string;
};

function toFormState(profile: LandlordProfileData): LandlordProfileFormState {
  return {
    fullName: profile.user.fullName ?? '',
    phone: profile.user.phone ?? '',
    agencyName: profile.profile.agencyName ?? '',
    licenseNumber: profile.profile.licenseNumber ?? '',
    portfolioSize:
      typeof profile.profile.portfolioSize === 'number' ? String(profile.profile.portfolioSize) : '',
    verificationStatus: profile.profile.verificationStatus ?? '',
  };
}

function parseNullableInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export default function LandlordProfileClient() {
  const { showNotice } = useGlobalNotice();
  const [profile, setProfile] = useState<LandlordProfileData | null>(null);
  const [formState, setFormState] = useState<LandlordProfileFormState>({
    fullName: '',
    phone: '',
    agencyName: '',
    licenseNumber: '',
    portfolioSize: '',
    verificationStatus: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const inputBg = useColorModeValue('white', 'navy.700');
  const inputBorder = useColorModeValue('secondaryGray.300', 'whiteAlpha.300');
  const inputFocusBorder = useColorModeValue('brand.500', 'brand.300');
  const saveButtonBg = useColorModeValue('brand.500', 'brand.300');
  const saveButtonHoverBg = useColorModeValue('brand.600', 'brand.400');

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await loadLandlordProfile();
      if (!result.ok || !result.data) {
        throw new Error(result.message || 'Failed to load profile.');
      }

      setProfile(result.data);
      setFormState(toFormState(result.data));
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile.';
      setLoadError(message);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const canSave = useMemo(() => {
    const portfolioSizeValue = parseNullableInteger(formState.portfolioSize);
    if (formState.portfolioSize.trim() && portfolioSizeValue === null) {
      return false;
    }

    return true;
  }, [formState.portfolioSize]);

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
    if (!profile || !canSave) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateLandlordProfile({
        fullName: formState.fullName.trim() ? formState.fullName.trim() : null,
        phone: formState.phone.trim() ? formState.phone.trim() : null,
        agencyName: formState.agencyName.trim() ? formState.agencyName.trim() : null,
        licenseNumber: formState.licenseNumber.trim() ? formState.licenseNumber.trim() : null,
        portfolioSize: parseNullableInteger(formState.portfolioSize),
        verificationStatus: formState.verificationStatus.trim() ? formState.verificationStatus.trim() : null,
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

  if (isLoading) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Skeleton h="36px" mb="12px" borderRadius="10px" />
        <Skeleton h="240px" borderRadius="16px" />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="16px" bg={panelBg}>
          <Text color={textPrimary} fontWeight="700" mb="8px">
            Unable to load landlord profile
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
          Edit landlord account details and portfolio profile.
        </Text>
      </Box>

      <Card p="16px" bg={panelBg}>
        <Flex justify="space-between" align="center" mb="10px">
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            Landlord Details
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
              Agency: {profile.profile.agencyName || '-'}
            </Text>
            <Text fontSize="sm" color={textSecondary} mb="6px">
              Licence Number: {profile.profile.licenseNumber || '-'}
            </Text>
            <Text fontSize="sm" color={textSecondary} mb="6px">
              Portfolio Size:{' '}
              {typeof profile.profile.portfolioSize === 'number' ? profile.profile.portfolioSize : '-'}
            </Text>
            <Text fontSize="sm" color={textSecondary}>
              Verification Status: {profile.profile.verificationStatus || '-'}
            </Text>
          </>
        ) : (
          <Box>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="10px" mb="10px">
              <FormControl>
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

              <FormControl>
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

              <FormControl>
                <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                  Agency Name
                </FormLabel>
                <Input
                  value={formState.agencyName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFormState((current) => ({ ...current, agencyName: event.target.value }))
                  }
                  bg={inputBg}
                  border="1px solid"
                  borderColor={inputBorder}
                  _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                  Licence Number
                </FormLabel>
                <Input
                  value={formState.licenseNumber}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFormState((current) => ({ ...current, licenseNumber: event.target.value }))
                  }
                  bg={inputBg}
                  border="1px solid"
                  borderColor={inputBorder}
                  _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                  Portfolio Size
                </FormLabel>
                <Input
                  type="number"
                  min={0}
                  value={formState.portfolioSize}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFormState((current) => ({ ...current, portfolioSize: event.target.value }))
                  }
                  bg={inputBg}
                  border="1px solid"
                  borderColor={inputBorder}
                  _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
                  Verification Status
                </FormLabel>
                <Input
                  value={formState.verificationStatus}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFormState((current) => ({ ...current, verificationStatus: event.target.value }))
                  }
                  bg={inputBg}
                  border="1px solid"
                  borderColor={inputBorder}
                  _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
                />
              </FormControl>
            </Grid>

            <Flex gap="8px" justify="flex-end">
              <Button
                size="sm"
                onClick={() => void handleSave()}
                loading={isSaving}
                disabled={isSaving || !canSave}
                bg={saveButtonBg}
                color="white"
                _hover={{ bg: saveButtonHoverBg }}
                _active={{ bg: saveButtonHoverBg }}
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
    </Box>
  );
}
