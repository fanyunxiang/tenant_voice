'use client';

import Card from 'components/card/Card';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Input,
  SimpleGrid,
  Text,
  useColorModeValue,
} from 'lib/chakra';

const conversations = [
  {
    id: 'conv-1',
    name: 'Olivia (Property Manager)',
    role: 'Landlord Team',
    lastMessage: 'Inspection confirmed for Friday 4:30 PM.',
    unread: 2,
    online: true,
  },
  {
    id: 'conv-2',
    name: 'Liam (Agent)',
    role: 'Leasing Agent',
    lastMessage: 'Can you upload the latest payslip?',
    unread: 0,
    online: false,
  },
  {
    id: 'conv-3',
    name: 'Ava (Current Tenant Ref)',
    role: 'Reference Contact',
    lastMessage: 'I can verify your rental history anytime.',
    unread: 1,
    online: true,
  },
];

const chatMessages = [
  {
    id: 'm1',
    sender: 'other',
    text: 'Hi, your application reached shortlist stage.',
    time: '9:12 AM',
  },
  {
    id: 'm2',
    sender: 'me',
    text: 'Great, do you need any extra documents from me?',
    time: '9:14 AM',
  },
  {
    id: 'm3',
    sender: 'other',
    text: 'Please upload your latest utility bill and we can finalise review.',
    time: '9:18 AM',
  },
];

const connectionRequests = [
  { id: 'r1', name: 'Noah Chen', type: 'Landlord', match: '92% profile fit' },
  { id: 'r2', name: 'Mia Patel', type: 'Property Manager', match: '88% profile fit' },
];

const recommendations = [
  { id: 'rec1', label: '2-bed in Parramatta', reason: 'Within budget + high owner rating' },
  { id: 'rec2', label: '1-bed in Strathfield', reason: 'Near preferred commute + pet friendly' },
];

export default function MessagesClient() {
  const pageBg = useColorModeValue('secondaryGray.300', 'navy.900');
  const cardBg = useColorModeValue('white', 'navy.800');
  const textPrimary = useColorModeValue('secondaryGray.900', 'white');
  const textSecondary = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const borderColor = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
  const mineBg = useColorModeValue('brand.100', 'brand.500');
  const otherBg = useColorModeValue('secondaryGray.200', 'whiteAlpha.100');

  return (
    <Box pt={{ base: '8px', md: '12px' }}>
      <Flex mb="16px" align="center" justify="space-between">
        <Box>
          <Text fontSize="2xl" fontWeight="700" color={textPrimary}>
            Messages
          </Text>
          <Text fontSize="sm" color={textSecondary}>
            In-app chat, connection requests, and profile recommendations (mock data)
          </Text>
        </Box>
        <Badge colorScheme="green" px="10px" py="6px" borderRadius="999px">
          Tenant Scope
        </Badge>
      </Flex>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" alignItems="start">
        <Card p="0" bg={cardBg}>
          <Flex px="18px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Text fontSize="md" fontWeight="700" color={textPrimary}>
              Conversations
            </Text>
          </Flex>
          <Box>
            {conversations.map((item) => (
              <Flex
                key={item.id}
                px="18px"
                py="14px"
                gap="10px"
                borderBottom="1px solid"
                borderColor={borderColor}
                _hover={{ bg: pageBg }}
                cursor="pointer"
              >
                <Box position="relative">
                  <Avatar name={item.name} />
                  {item.online ? (
                    <Box
                      position="absolute"
                      bottom="1px"
                      right="1px"
                      w="10px"
                      h="10px"
                      bg="green.400"
                      borderRadius="50%"
                      border="2px solid"
                      borderColor={cardBg}
                    />
                  ) : null}
                </Box>
                <Box flex="1" minW="0">
                  <Flex justify="space-between" align="center">
                    <Text fontSize="sm" fontWeight="600" color={textPrimary} noOfLines={1}>
                      {item.name}
                    </Text>
                    {item.unread > 0 ? (
                      <Badge colorScheme="purple" borderRadius="999px">
                        {item.unread}
                      </Badge>
                    ) : null}
                  </Flex>
                  <Text fontSize="xs" color={textSecondary}>
                    {item.role}
                  </Text>
                  <Text fontSize="sm" color={textSecondary} noOfLines={1}>
                    {item.lastMessage}
                  </Text>
                </Box>
              </Flex>
            ))}
          </Box>
        </Card>

        <Card p="0" bg={cardBg} gridColumn={{ base: 'auto', xl: 'span 1' }}>
          <Flex px="18px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
            <Text fontSize="md" fontWeight="700" color={textPrimary}>
              Chat: Olivia (Property Manager)
            </Text>
          </Flex>
          <Flex direction="column" px="18px" py="14px" gap="10px" minH="320px">
            {chatMessages.map((msg) => {
              const isMine = msg.sender === 'me';
              return (
                <Flex key={msg.id} justify={isMine ? 'flex-end' : 'flex-start'}>
                  <Box
                    maxW="85%"
                    px="12px"
                    py="10px"
                    borderRadius="12px"
                    bg={isMine ? mineBg : otherBg}
                  >
                    <Text fontSize="sm" color={textPrimary}>
                      {msg.text}
                    </Text>
                    <Text
                      fontSize="xs"
                      mt="4px"
                      color={textSecondary}
                      textAlign={isMine ? 'right' : 'left'}
                    >
                      {msg.time}
                    </Text>
                  </Box>
                </Flex>
              );
            })}
          </Flex>
          <Flex px="18px" pb="16px" gap="8px">
            <Input placeholder="Type a message..." />
            <Button colorScheme="purple">Send</Button>
          </Flex>
        </Card>

        <Flex direction="column" gap="20px">
          <Card p="0" bg={cardBg}>
            <Flex px="18px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
              <Text fontSize="md" fontWeight="700" color={textPrimary}>
                Connection Requests
              </Text>
            </Flex>
            <Box p="14px" pt="10px">
              {connectionRequests.map((request) => (
                <Flex key={request.id} align="center" justify="space-between" py="8px" gap="10px">
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color={textPrimary}>
                      {request.name}
                    </Text>
                    <Text fontSize="xs" color={textSecondary}>
                      {request.type} • {request.match}
                    </Text>
                  </Box>
                  <Flex gap="6px">
                    <Button size="sm" variant="outline">
                      Ignore
                    </Button>
                    <Button size="sm" colorScheme="purple">
                      Accept
                    </Button>
                  </Flex>
                </Flex>
              ))}
            </Box>
          </Card>

          <Card p="0" bg={cardBg}>
            <Flex px="18px" py="14px" borderBottom="1px solid" borderColor={borderColor}>
              <Text fontSize="md" fontWeight="700" color={textPrimary}>
                Recommended Matches
              </Text>
            </Flex>
            <Box p="14px" pt="10px">
              {recommendations.map((item) => (
                <Box key={item.id} py="8px">
                  <Text fontSize="sm" fontWeight="600" color={textPrimary}>
                    {item.label}
                  </Text>
                  <Text fontSize="xs" color={textSecondary}>
                    {item.reason}
                  </Text>
                </Box>
              ))}
            </Box>
          </Card>
        </Flex>
      </SimpleGrid>
    </Box>
  );
}
