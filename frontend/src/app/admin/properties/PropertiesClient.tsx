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
  Select,
  Skeleton,
  Text,
  Textarea,
  useColorModeValue,
} from 'lib/chakra';
import { loadSession } from 'lib/auth/client';
import {
  createLandlordProperty,
  deleteLandlordProperty,
  LANDLORD_PROPERTY_TYPES,
  LandlordListingStatus,
  LandlordPropertyListItem,
  loadLandlordProperties,
  setLandlordListingStatus,
  updateLandlordProperty,
} from 'lib/landlord/propertiesClient';

type PropertyFormState = {
  title: string;
  description: string;
  weeklyRent: string;
  availableFrom: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  bedrooms: string;
  bathrooms: string;
  propertyType: string;
};

type AddressSuggestion = {
  id: string;
  label: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
};

type AddressAutocompleteApiResponse = {
  ok: boolean;
  message?: string;
  data?: {
    suggestions?: AddressSuggestion[];
  };
};

const ADDRESS_MIN_QUERY_LENGTH = 3;
const ADDRESS_DEBOUNCE_MS = 320;

const STATUS_LABELS: Record<LandlordListingStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已上架',
  PAUSED: '已下架',
  APPLICATIONS_CLOSED: '已关闭申请',
  LEASED: '已出租',
  ARCHIVED: '已归档',
};

function isLandlordPropertyType(value: string): value is (typeof LANDLORD_PROPERTY_TYPES)[number] {
  return LANDLORD_PROPERTY_TYPES.some((type) => type === value);
}

function emptyForm(): PropertyFormState {
  return {
    title: '',
    description: '',
    weeklyRent: '',
    availableFrom: '',
    addressLine1: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    bedrooms: '',
    bathrooms: '',
    propertyType: 'APARTMENT',
  };
}

function toFormState(item: LandlordPropertyListItem): PropertyFormState {
  return {
    title: item.title,
    description: item.description ?? '',
    weeklyRent: String(item.weeklyRent),
    availableFrom: item.availableFrom ?? '',
    addressLine1: item.addressLine1,
    suburb: item.suburb,
    state: item.state,
    postcode: item.postcode,
    bedrooms: typeof item.bedrooms === 'number' ? String(item.bedrooms) : '',
    bathrooms: typeof item.bathrooms === 'number' ? String(item.bathrooms) : '',
    propertyType: item.propertyType,
  };
}

function parseNullableInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function parsePositiveNumber(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

async function fetchAddressSuggestions(
  text: string,
  signal: AbortSignal,
): Promise<AddressSuggestion[]> {
  const response = await fetch(`/api/geo/address-autocomplete?text=${encodeURIComponent(text)}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  });

  let body: AddressAutocompleteApiResponse | null = null;
  try {
    body = (await response.json()) as AddressAutocompleteApiResponse;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.ok) {
    throw new Error(body?.message || 'Failed to load address suggestions.');
  }

  return body.data?.suggestions ?? [];
}

export default function PropertiesClient() {
  const { showNotice } = useGlobalNotice();
  const [properties, setProperties] = useState<LandlordPropertyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLandlord, setIsLandlord] = useState<boolean | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PropertyFormState>(emptyForm());
  const [isCreating, setIsCreating] = useState(false);

  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PropertyFormState>(emptyForm());
  const [isUpdating, setIsUpdating] = useState(false);
  const [createAddressSuggestions, setCreateAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [editAddressSuggestions, setEditAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isCreateAddressLoading, setIsCreateAddressLoading] = useState(false);
  const [isEditAddressLoading, setIsEditAddressLoading] = useState(false);

  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);

  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const inputBg = useColorModeValue('white', 'navy.700');
  const inputBorder = useColorModeValue('secondaryGray.300', 'whiteAlpha.300');
  const inputFocusBorder = useColorModeValue('brand.500', 'brand.300');
  const primaryButtonBg = useColorModeValue('brand.500', 'brand.300');
  const primaryButtonHoverBg = useColorModeValue('brand.600', 'brand.400');

  const totalListings = properties.length;
  const publishedListings = useMemo(
    () => properties.filter((item) => item.status === 'PUBLISHED').length,
    [properties],
  );

  const refreshProperties = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const result = await loadLandlordProperties();
        if (!result.ok || !result.data) {
          throw new Error(result.message || 'Failed to load properties.');
        }

        setProperties(result.data.properties);
        setLoadError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load properties.';
        setLoadError(message);

        if (mode === 'refresh') {
          showNotice({ type: 'error', message });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showNotice],
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const sessionResult = await loadSession();
        if (cancelled) {
          return;
        }

        const landlord = Boolean(sessionResult.ok && sessionResult.user?.primary_role === 'LANDLORD');
        setIsLandlord(landlord);

        if (landlord) {
          await refreshProperties('initial');
        } else {
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsLandlord(false);
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [refreshProperties]);

  useEffect(() => {
    if (!isCreateOpen) {
      setCreateAddressSuggestions([]);
      setIsCreateAddressLoading(false);
      return;
    }

    const query = createForm.addressLine1.trim();
    if (query.length < ADDRESS_MIN_QUERY_LENGTH) {
      setCreateAddressSuggestions([]);
      setIsCreateAddressLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsCreateAddressLoading(true);

    const timer = setTimeout(() => {
      void fetchAddressSuggestions(query, controller.signal)
        .then((suggestions) => {
          setCreateAddressSuggestions(suggestions);
        })
        .catch((error) => {
          if (!isAbortError(error)) {
            setCreateAddressSuggestions([]);
          }
        })
        .finally(() => {
          setIsCreateAddressLoading(false);
        });
    }, ADDRESS_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isCreateOpen, createForm.addressLine1]);

  useEffect(() => {
    if (!editingListingId) {
      setEditAddressSuggestions([]);
      setIsEditAddressLoading(false);
      return;
    }

    const query = editForm.addressLine1.trim();
    if (query.length < ADDRESS_MIN_QUERY_LENGTH) {
      setEditAddressSuggestions([]);
      setIsEditAddressLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsEditAddressLoading(true);

    const timer = setTimeout(() => {
      void fetchAddressSuggestions(query, controller.signal)
        .then((suggestions) => {
          setEditAddressSuggestions(suggestions);
        })
        .catch((error) => {
          if (!isAbortError(error)) {
            setEditAddressSuggestions([]);
          }
        })
        .finally(() => {
          setIsEditAddressLoading(false);
        });
    }, ADDRESS_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editingListingId, editForm.addressLine1]);

  const submitCreate = async () => {
    const weeklyRent = parsePositiveNumber(createForm.weeklyRent);
    if (!weeklyRent) {
      showNotice({ type: 'error', message: 'Weekly rent must be a positive number.' });
      return;
    }

    setIsCreating(true);

    try {
      const result = await createLandlordProperty({
        title: createForm.title.trim(),
        description: createForm.description.trim() ? createForm.description.trim() : null,
        weeklyRent,
        availableFrom: createForm.availableFrom.trim() ? createForm.availableFrom.trim() : null,
        addressLine1: createForm.addressLine1.trim(),
        suburb: createForm.suburb.trim(),
        state: createForm.state.trim().toUpperCase(),
        postcode: createForm.postcode.trim(),
        bedrooms: parseNullableInt(createForm.bedrooms),
        bathrooms: parseNullableInt(createForm.bathrooms),
        propertyType: isLandlordPropertyType(createForm.propertyType) ? createForm.propertyType : 'OTHER',
      });

      if (!result.ok) {
        throw new Error(result.message || 'Failed to create property.');
      }

      showNotice({ type: 'success', message: result.message || 'Property created as draft.' });
      setCreateForm(emptyForm());
      setCreateAddressSuggestions([]);
      setIsCreateOpen(false);
      await refreshProperties('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create property.';
      showNotice({ type: 'error', message });
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (item: LandlordPropertyListItem) => {
    setEditingListingId(item.listingId);
    setEditForm(toFormState(item));
    setEditAddressSuggestions([]);
  };

  const cancelEdit = () => {
    setEditingListingId(null);
    setEditForm(emptyForm());
    setEditAddressSuggestions([]);
  };

  const applyAddressSuggestion = (mode: 'create' | 'edit', suggestion: AddressSuggestion) => {
    if (mode === 'create') {
      setCreateForm((current) => ({
        ...current,
        addressLine1: suggestion.addressLine1 || current.addressLine1,
        suburb: suggestion.suburb || current.suburb,
        state: suggestion.state || current.state,
        postcode: suggestion.postcode || current.postcode,
      }));
      setCreateAddressSuggestions([]);
      return;
    }

    setEditForm((current) => ({
      ...current,
      addressLine1: suggestion.addressLine1 || current.addressLine1,
      suburb: suggestion.suburb || current.suburb,
      state: suggestion.state || current.state,
      postcode: suggestion.postcode || current.postcode,
    }));
    setEditAddressSuggestions([]);
  };

  const submitEdit = async () => {
    if (!editingListingId) {
      return;
    }

    const weeklyRent = parsePositiveNumber(editForm.weeklyRent);
    if (!weeklyRent) {
      showNotice({ type: 'error', message: 'Weekly rent must be a positive number.' });
      return;
    }

    setIsUpdating(true);

    try {
      const result = await updateLandlordProperty(editingListingId, {
        title: editForm.title.trim(),
        description: editForm.description.trim() ? editForm.description.trim() : null,
        weeklyRent,
        availableFrom: editForm.availableFrom.trim() ? editForm.availableFrom.trim() : null,
        addressLine1: editForm.addressLine1.trim(),
        suburb: editForm.suburb.trim(),
        state: editForm.state.trim().toUpperCase(),
        postcode: editForm.postcode.trim(),
        bedrooms: parseNullableInt(editForm.bedrooms),
        bathrooms: parseNullableInt(editForm.bathrooms),
      });

      if (!result.ok) {
        throw new Error(result.message || 'Failed to update property.');
      }

      showNotice({ type: 'success', message: result.message || 'Property updated.' });
      cancelEdit();
      await refreshProperties('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update property.';
      showNotice({ type: 'error', message });
    } finally {
      setIsUpdating(false);
    }
  };

  const changeStatus = async (listingId: string, status: LandlordListingStatus, actionLabel: string) => {
    setActionLoadingKey(`${listingId}:${status}`);

    try {
      const result = await setLandlordListingStatus(listingId, status);
      if (!result.ok) {
        throw new Error(result.message || `Failed to ${actionLabel}.`);
      }

      showNotice({ type: 'success', message: result.message || `Listing ${actionLabel}.` });
      await refreshProperties('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${actionLabel}.`;
      showNotice({ type: 'error', message });
    } finally {
      setActionLoadingKey(null);
    }
  };

  const removeListing = async (listingId: string) => {
    setActionLoadingKey(`${listingId}:DELETE`);

    try {
      const result = await deleteLandlordProperty(listingId);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to delete listing.');
      }

      showNotice({ type: 'success', message: result.message || 'Listing deleted.' });
      await refreshProperties('refresh');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete listing.';
      showNotice({ type: 'error', message });
    } finally {
      setActionLoadingKey(null);
    }
  };

  const renderPropertyForm = (
    mode: 'create' | 'edit',
    form: PropertyFormState,
    onChange: (field: keyof PropertyFormState, value: string) => void,
    onSubmit: () => void,
    onCancel: () => void,
    loading: boolean,
  ) => {
    const addressSuggestions = mode === 'create' ? createAddressSuggestions : editAddressSuggestions;
    const isAddressLoading = mode === 'create' ? isCreateAddressLoading : isEditAddressLoading;

    return (
      <Box>
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="10px">
        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Title
          </FormLabel>
          <Input
            value={form.title}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('title', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Weekly Rent (AUD)
          </FormLabel>
          <Input
            type="number"
            min={1}
            value={form.weeklyRent}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('weeklyRent', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        <FormControl position="relative">
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Address Line 1
          </FormLabel>
          <Input
            value={form.addressLine1}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('addressLine1', event.target.value)}
            placeholder="Start typing an Australian address..."
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
          {isAddressLoading || addressSuggestions.length > 0 ? (
            <Box
              position="absolute"
              left="0"
              right="0"
              top="calc(100% + 4px)"
              bg={panelBg}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="12px"
              zIndex="dropdown"
              maxH="220px"
              overflowY="auto"
              boxShadow="md"
            >
              {isAddressLoading ? (
                <Text px="10px" py="8px" fontSize="xs" color={textSecondary}>
                  Searching AU addresses...
                </Text>
              ) : (
                addressSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion.id}
                    size="sm"
                    variant="ghost"
                    justifyContent="flex-start"
                    w="100%"
                    borderRadius="0"
                    fontWeight="500"
                    color={textPrimary}
                    onClick={() => applyAddressSuggestion(mode, suggestion)}
                    _hover={{ bg: inputBg }}
                  >
                    {suggestion.label}
                  </Button>
                ))
              )}
            </Box>
          ) : null}
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Suburb
          </FormLabel>
          <Input
            value={form.suburb}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('suburb', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            State
          </FormLabel>
          <Input
            value={form.state}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('state', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Postcode
          </FormLabel>
          <Input
            value={form.postcode}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('postcode', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Bedrooms
          </FormLabel>
          <Input
            type="number"
            min={0}
            value={form.bedrooms}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('bedrooms', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Bathrooms
          </FormLabel>
          <Input
            type="number"
            min={0}
            value={form.bathrooms}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('bathrooms', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Available From
          </FormLabel>
          <Input
            type="date"
            value={form.availableFrom}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange('availableFrom', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
          />
        </FormControl>

        {mode === 'create' ? (
          <FormControl>
            <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
              Property Type
            </FormLabel>
            <Select
              value={form.propertyType}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange('propertyType', event.target.value)}
            >
              {LANDLORD_PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormControl>
        ) : null}
        </Grid>

        <FormControl mt="10px">
          <FormLabel fontSize="xs" fontWeight="700" color={textPrimary} mb="6px">
            Description
          </FormLabel>
          <Textarea
            value={form.description}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange('description', event.target.value)}
            bg={inputBg}
            border="1px solid"
            borderColor={inputBorder}
            _focusVisible={{ borderColor: inputFocusBorder, boxShadow: 'none' }}
            rows={4}
          />
        </FormControl>

        <Flex justify="flex-end" gap="8px" mt="12px">
          <Button
            size="sm"
            onClick={onSubmit}
            loading={loading}
            disabled={loading}
            bg={primaryButtonBg}
            color="white"
            _hover={{ bg: primaryButtonHoverBg }}
            _active={{ bg: primaryButtonHoverBg }}
          >
            {mode === 'create' ? 'Create Draft' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </Flex>
      </Box>
    );
  };

  if (isLandlord === false) {
    return (
      <Box pt={{ base: '8px', md: '12px' }}>
        <Card p="18px" bg={panelBg}>
          <Text color={textPrimary} fontWeight="700" mb="6px">
            Properties is landlord-only
          </Text>
          <Text color={textSecondary} fontSize="sm">
            当前账号不是房东角色，请使用租客菜单页面。
          </Text>
        </Card>
      </Box>
    );
  }

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Flex mb="16px" align="center" justify="space-between" gap="8px" wrap="wrap">
        <Box>
          <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
            Properties
          </Text>
          <Text fontSize="sm" color={textSecondary}>
            房源管理：上架、下架、编辑、删除。
          </Text>
        </Box>

        <Flex gap="8px">
          <Button size="sm" onClick={() => void refreshProperties('refresh')} loading={isRefreshing}>
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setIsCreateOpen(true);
              setCreateForm(emptyForm());
            }}
            bg={primaryButtonBg}
            color="white"
            _hover={{ bg: primaryButtonHoverBg }}
            _active={{ bg: primaryButtonHoverBg }}
          >
            Add Property
          </Button>
        </Flex>
      </Flex>

      <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap="12px" mb="16px">
        <Card p="14px" bg={panelBg}>
          <Text fontSize="xs" color={textSecondary} mb="4px">
            Total Listings
          </Text>
          <Text fontSize="2xl" lineHeight="1" fontWeight="700" color={textPrimary}>
            {isLoading ? '-' : totalListings}
          </Text>
        </Card>

        <Card p="14px" bg={panelBg}>
          <Text fontSize="xs" color={textSecondary} mb="4px">
            Published
          </Text>
          <Text fontSize="2xl" lineHeight="1" fontWeight="700" color={textPrimary}>
            {isLoading ? '-' : publishedListings}
          </Text>
        </Card>

        <Card p="14px" bg={panelBg}>
          <Text fontSize="xs" color={textSecondary} mb="4px">
            Draft / Paused
          </Text>
          <Text fontSize="2xl" lineHeight="1" fontWeight="700" color={textPrimary}>
            {isLoading
              ? '-'
              : properties.filter((item) => item.status === 'DRAFT' || item.status === 'PAUSED').length}
          </Text>
        </Card>

        <Card p="14px" bg={panelBg}>
          <Text fontSize="xs" color={textSecondary} mb="4px">
            Pending Applications
          </Text>
          <Text fontSize="2xl" lineHeight="1" fontWeight="700" color={textPrimary}>
            {isLoading ? '-' : properties.reduce((sum, item) => sum + item.pendingApplications, 0)}
          </Text>
        </Card>
      </Grid>

      {isCreateOpen ? (
        <Card p="16px" mb="16px" bg={panelBg}>
          <Text fontSize="md" fontWeight="700" color={textPrimary} mb="10px">
            Create New Property Listing
          </Text>
          {renderPropertyForm(
            'create',
            createForm,
            (field, value) => setCreateForm((current) => ({ ...current, [field]: value })),
            () => void submitCreate(),
            () => {
              setIsCreateOpen(false);
              setCreateForm(emptyForm());
            },
            isCreating,
          )}
        </Card>
      ) : null}

      <Card p="0" bg={panelBg}>
        <Flex px="16px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
          <Text fontSize="md" fontWeight="700" color={textPrimary}>
            Managed Listings
          </Text>
        </Flex>

        {isLoading ? (
          <Box p="16px">
            <Skeleton h="80px" borderRadius="10px" mb="10px" />
            <Skeleton h="80px" borderRadius="10px" />
          </Box>
        ) : properties.length === 0 ? (
          <Box p="16px">
            <Text fontSize="sm" color={textSecondary}>
              {loadError || 'No listings yet. Create your first draft property.'}
            </Text>
          </Box>
        ) : (
          <Box>
            {properties.map((item) => {
              const isEditing = editingListingId === item.listingId;
              const isRowBusy = actionLoadingKey?.startsWith(item.listingId) || (isEditing && isUpdating);
              const canPublish =
                item.status === 'DRAFT' || item.status === 'PAUSED' || item.status === 'APPLICATIONS_CLOSED';
              const canPause = item.status === 'PUBLISHED';

              return (
                <Box key={item.listingId} borderBottom="1px solid" borderColor={borderColor} px="16px" py="14px">
                  <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap="10px" wrap="wrap">
                    <Box>
                      <Text fontWeight="700" color={textPrimary}>
                        {item.title}
                      </Text>
                      <Text fontSize="sm" color={textSecondary}>
                        {item.addressLine1}, {item.suburb} {item.state} {item.postcode}
                      </Text>
                      <Text fontSize="sm" color={textSecondary}>
                        ${item.weeklyRent}/week
                        {typeof item.bedrooms === 'number' ? ` • ${item.bedrooms} bed` : ''}
                        {typeof item.bathrooms === 'number' ? ` • ${item.bathrooms} bath` : ''}
                        {item.availableFrom ? ` • Available ${item.availableFrom}` : ''}
                      </Text>
                      <Text fontSize="xs" color={textSecondary}>
                        Pending applications: {item.pendingApplications}
                      </Text>
                    </Box>

                    <Flex align="center" gap="8px" wrap="wrap">
                      <Badge colorScheme={item.status === 'PUBLISHED' ? 'green' : 'purple'}>
                        {STATUS_LABELS[item.status]}
                      </Badge>

                      {canPublish ? (
                        <Button
                          size="xs"
                          onClick={() => void changeStatus(item.listingId, 'PUBLISHED', 'published')}
                          loading={actionLoadingKey === `${item.listingId}:PUBLISHED`}
                          disabled={Boolean(isRowBusy)}
                          bg={primaryButtonBg}
                          color="white"
                          _hover={{ bg: primaryButtonHoverBg }}
                          _active={{ bg: primaryButtonHoverBg }}
                        >
                          上架
                        </Button>
                      ) : null}

                      {canPause ? (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void changeStatus(item.listingId, 'PAUSED', 'paused')}
                          loading={actionLoadingKey === `${item.listingId}:PAUSED`}
                          disabled={Boolean(isRowBusy)}
                        >
                          下架
                        </Button>
                      ) : null}

                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => startEdit(item)}
                        disabled={Boolean(isRowBusy)}
                      >
                        编辑
                      </Button>

                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void removeListing(item.listingId)}
                        loading={actionLoadingKey === `${item.listingId}:DELETE`}
                        disabled={Boolean(isRowBusy)}
                      >
                        删除
                      </Button>
                    </Flex>
                  </Flex>

                  {isEditing ? (
                    <Box mt="12px">
                      {renderPropertyForm(
                        'edit',
                        editForm,
                        (field, value) => setEditForm((current) => ({ ...current, [field]: value })),
                        () => void submitEdit(),
                        cancelEdit,
                        isUpdating,
                      )}
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        )}
      </Card>
    </Box>
  );
}
