'use client';

import Card from 'components/card/Card';
import { Badge, Box, Button, Flex, Input, SimpleGrid, Text, useColorModeValue } from 'lib/chakra';
import Nft1 from 'img/nfts/Nft1.png';
import Nft2 from 'img/nfts/Nft2.png';
import Nft3 from 'img/nfts/Nft3.png';
import Nft4 from 'img/nfts/Nft4.png';
import Nft5 from 'img/nfts/Nft5.png';
import Nft6 from 'img/nfts/Nft6.png';
import Image, { StaticImageData } from 'next/image';

type Listing = {
  id: string;
  title: string;
  suburb: string;
  rentPerWeek: string;
  beds: number;
  baths: number;
  parking: number;
  ownerRating: number;
  ownerReviewCount: number;
  image: StaticImageData;
  status: 'Available' | 'Open Inspection' | 'Application Open';
};

const listingFilters = ['All', 'Apartment', 'House', 'Studio', 'Pet Friendly'];

const listings: Listing[] = [
  {
    id: 'l-1',
    title: '2 Bedroom Apartment',
    suburb: 'Parramatta, NSW',
    rentPerWeek: '$680/week',
    beds: 2,
    baths: 1,
    parking: 1,
    ownerRating: 4.8,
    ownerReviewCount: 31,
    image: Nft1,
    status: 'Available',
  },
  {
    id: 'l-2',
    title: '1 Bedroom Unit',
    suburb: 'Strathfield, NSW',
    rentPerWeek: '$560/week',
    beds: 1,
    baths: 1,
    parking: 0,
    ownerRating: 4.6,
    ownerReviewCount: 20,
    image: Nft2,
    status: 'Open Inspection',
  },
  {
    id: 'l-3',
    title: '2 Bedroom Townhouse',
    suburb: 'Rhodes, NSW',
    rentPerWeek: '$720/week',
    beds: 2,
    baths: 2,
    parking: 1,
    ownerRating: 4.9,
    ownerReviewCount: 44,
    image: Nft3,
    status: 'Application Open',
  },
  {
    id: 'l-4',
    title: '3 Bedroom House',
    suburb: 'Blacktown, NSW',
    rentPerWeek: '$810/week',
    beds: 3,
    baths: 2,
    parking: 2,
    ownerRating: 4.5,
    ownerReviewCount: 17,
    image: Nft4,
    status: 'Open Inspection',
  },
  {
    id: 'l-5',
    title: '1 Bedroom Apartment',
    suburb: 'Burwood, NSW',
    rentPerWeek: '$545/week',
    beds: 1,
    baths: 1,
    parking: 0,
    ownerRating: 4.4,
    ownerReviewCount: 12,
    image: Nft5,
    status: 'Available',
  },
  {
    id: 'l-6',
    title: '2 Bedroom Apartment',
    suburb: 'Hurstville, NSW',
    rentPerWeek: '$640/week',
    beds: 2,
    baths: 1,
    parking: 1,
    ownerRating: 4.7,
    ownerReviewCount: 29,
    image: Nft6,
    status: 'Application Open',
  },
];

export default function ListingsClient() {
  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const panelBg = useColorModeValue('white', 'navy.800');
  const filterActiveBg = useColorModeValue('brand.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Flex mb="16px" align="center" justify="space-between" wrap="wrap" gap="8px">
        <Box>
          <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
            Listings
          </Text>
          <Text fontSize="sm" color={textSecondary}>
            Browse rentals, filter properties, and review landlord ratings (mock data)
          </Text>
        </Box>
      </Flex>

      <Card p="14px" mb="16px" bg={panelBg}>
        <Flex gap="10px" wrap="wrap" mb="10px">
          {listingFilters.map((item, idx) => (
            <Button
              key={item}
              size="sm"
              variant="ghost"
              bg={idx === 0 ? filterActiveBg : 'transparent'}
              border="1px solid"
              borderColor={idx === 0 ? 'transparent' : borderColor}
            >
              {item}
            </Button>
          ))}
        </Flex>
        <Input placeholder="Search suburb, rent, or landlord..." />
      </Card>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
        {listings.map((listing) => (
          <Card key={listing.id} p="0" bg={panelBg} overflow="hidden">
            <Box position="relative" h="170px">
              <Image
                src={listing.image}
                alt={listing.title}
                fill
                sizes="(min-width: 1280px) 33vw, 100vw"
              />
            </Box>
            <Box p="14px">
              <Flex justify="space-between" align="center" mb="6px">
                <Text color={textPrimary} fontWeight="700" fontSize="md" noOfLines={1}>
                  {listing.title}
                </Text>
                <Badge colorScheme="purple">{listing.status}</Badge>
              </Flex>
              <Text color={textSecondary} fontSize="sm" mb="10px">
                {listing.suburb}
              </Text>
              <Text color={textPrimary} fontSize="lg" fontWeight="700" mb="10px">
                {listing.rentPerWeek}
              </Text>
              <Text color={textSecondary} fontSize="sm" mb="10px">
                {listing.beds} bed • {listing.baths} bath • {listing.parking} parking
              </Text>
              <Text color={textSecondary} fontSize="sm" mb="12px">
                Landlord rating {listing.ownerRating} ({listing.ownerReviewCount} verified reviews)
              </Text>
              <Button colorScheme="purple" size="sm">
                Apply
              </Button>
            </Box>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  );
}
