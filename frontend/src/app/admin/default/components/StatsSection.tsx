import { Box, Flex, FormLabel, Icon, Select, SimpleGrid, Text } from 'lib/chakra';
import IconBox from 'components/icons/IconBox';
import { MdAddTask, MdAttachMoney, MdBarChart, MdFileCopy } from 'react-icons/md';
import Image from 'next/image';
import Usa from 'img/dashboards/usa.png';

const stats = [
  {
    label: 'Earnings',
    value: '$350.4',
    icon: MdBarChart,
  },
  {
    label: 'Spend this month',
    value: '$642.39',
    icon: MdAttachMoney,
  },
  {
    label: 'Sales',
    value: '$574.34',
    accent: '+23%',
  },
  {
    label: 'New Tasks',
    value: '154',
    icon: MdAddTask,
    gradient: 'linear-gradient(90deg, #4481EB 0%, #04BEFE 100%)',
  },
  {
    label: 'Total Projects',
    value: '2935',
    icon: MdFileCopy,
  },
];

const cardStyles = {
  borderRadius: '30px',
  bg: 'white',
  _dark: { bg: 'navy.900' },
  p: '24px',
  boxShadow: 'sm',
};

export default function StatsSection() {
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3, '2xl': 6 }} gap="20px" mb="20px">
      {stats.slice(0, 2).map((stat) => (
        <Flex key={stat.label} direction="column" {...cardStyles}>
          <IconBox
            w="56px"
            h="56px"
            mb="18px"
            bg={stat.gradient ?? 'secondaryGray.300'}
            _dark={{
              bg: stat.gradient ? stat.gradient : 'whiteAlpha.100',
            }}
            icon={
              stat.icon ? (
                <Icon
                  as={stat.icon}
                  w="32px"
                  h="32px"
                  color={stat.gradient ? 'white' : 'brand.500'}
                />
              ) : undefined
            }
          />
          <Text color="secondaryGray.600" fontSize="sm">
            {stat.label}
          </Text>
          <Text fontSize="2xl" fontWeight="700" color="secondaryGray.900">
            {stat.value}
          </Text>
        </Flex>
      ))}

      <Flex direction="column" {...cardStyles}>
        <Text color="secondaryGray.600" fontSize="sm">
          Sales
        </Text>
        <Text fontSize="2xl" fontWeight="700" color="secondaryGray.900">
          {stats[2].value}
        </Text>
        <Text fontSize="sm" color="green.400" fontWeight="600">
          {stats[2].accent} since last month
        </Text>
      </Flex>

      <Flex direction="column" {...cardStyles}>
        <Text color="secondaryGray.600" fontSize="sm" mb="12px">
          Your balance
        </Text>
        <Flex align="center" mb="18px">
          <FormLabel htmlFor="balance" mb="0">
            <Box boxSize="48px" borderRadius="full" overflow="hidden">
              <Image src={Usa} alt="USA" sizes="48px" priority unoptimized />
            </Box>
          </FormLabel>
          <Select id="balance" variant="filled" defaultValue="usd">
            <option value="usd">USD</option>
            <option value="eur">EUR</option>
            <option value="gba">GBA</option>
          </Select>
        </Flex>
        <Text fontSize="2xl" fontWeight="700" color="secondaryGray.900">
          $1,000
        </Text>
      </Flex>

      {stats.slice(3).map((stat) => (
        <Flex key={stat.label} direction="column" {...cardStyles}>
          <IconBox
            w="56px"
            h="56px"
            mb="18px"
            bg={stat.gradient ?? 'secondaryGray.300'}
            _dark={{
              bg: stat.gradient ? stat.gradient : 'whiteAlpha.100',
            }}
            icon={
              stat.icon ? (
                <Icon
                  as={stat.icon}
                  w="28px"
                  h="28px"
                  color={stat.gradient ? 'white' : 'brand.500'}
                />
              ) : undefined
            }
          />
          <Text color="secondaryGray.600" fontSize="sm">
            {stat.label}
          </Text>
          <Text fontSize="2xl" fontWeight="700" color="secondaryGray.900">
            {stat.value}
          </Text>
        </Flex>
      ))}
    </SimpleGrid>
  );
}
