import type { TeamLearningIdentity } from './spiritAnimals'

export const CLOTHING_COMPETITION_ID = '9df4f70a-2532-4f11-9a6d-013ab7110c25'

/** September 17: identities belong to fixed session_players slots, never occupants. */
export const CLOTHING_SLOT_IDENTITIES = [
  { rosterId: '66947781-5586-4682-b5ee-4af5992ae893', imageUrl: '/clothing-learning/v2/hat.png', english: 'Hat', thai: 'หมวก', phonetic: 'muak' },
  { rosterId: '53d8b061-b232-4545-be24-e3b478a5ca6e', imageUrl: '/clothing-learning/v2/sunglasses.png', english: 'Sunglasses', thai: 'แว่นกันแดด', phonetic: 'waen-gan-daet' },
  { rosterId: 'e132d938-4343-4204-b835-316d005c2d2b', imageUrl: '/clothing-learning/v2/t-shirt.png', english: 'T-shirt', thai: 'เสื้อยืด', phonetic: 'suea-yuet' },
  { rosterId: 'd4d505c0-d4fb-4767-a6ac-3e9a446ab47c', imageUrl: '/clothing-learning/v2/shirt.png', english: 'Shirt', thai: 'เสื้อเชิ้ต', phonetic: 'suea-chert' },
  { rosterId: 'dc7afe24-95f6-4698-b782-59ae8e612467', imageUrl: '/clothing-learning/v2/jacket.png', english: 'Jacket', thai: 'เสื้อแจ็กเก็ต', phonetic: 'suea-jaek-get' },
  { rosterId: 'fb851ad3-8ff8-4879-a66f-dfbaf371622b', imageUrl: '/clothing-learning/v2/shorts.png', english: 'Shorts', thai: 'กางเกงขาสั้น', phonetic: 'gaang-gaeng-khaa-san' },
  { rosterId: '735b6518-0475-47bb-8e9c-33c3eabbfb5d', imageUrl: '/clothing-learning/v2/shoes.png', english: 'Shoes', thai: 'รองเท้า', phonetic: 'rawng-thaao' },
  { rosterId: '9cbdc586-59e2-42f9-8d23-964d480a5786', imageUrl: '/clothing-learning/v2/socks.png', english: 'Socks', thai: 'ถุงเท้า', phonetic: 'thung-thaao' },
  { rosterId: '50d128f0-9586-4d0b-b14d-a34fbe273f77', imageUrl: '/clothing-learning/v2/dress.png', english: 'Dress', thai: 'ชุดเดรส', phonetic: 'chut-dret' },
  { rosterId: '4cf622e9-f36b-4ae8-af17-478c08b36f75', imageUrl: '/clothing-learning/v2/skirt.png', english: 'Skirt', thai: 'กระโปรง', phonetic: 'gra-bprohng' },
  { rosterId: 'dfe13fdf-c406-4295-8070-ed7f871da0d9', imageUrl: '/clothing-learning/v2/belt.png', english: 'Belt', thai: 'เข็มขัด', phonetic: 'khem-khat' },
  { rosterId: 'e1103861-8fe9-4ab3-a282-eca676cf86da', imageUrl: '/clothing-learning/v2/scarf.png', english: 'Scarf', thai: 'ผ้าพันคอ', phonetic: 'phaa-phan-khaw' },
  { rosterId: '7963cc61-698d-4d62-902f-064632612893', imageUrl: '/clothing-learning/v2/gloves.png', english: 'Gloves', thai: 'ถุงมือ', phonetic: 'thung-mue' },
  { rosterId: '74faa3fb-12a0-435d-9418-96d096777aec', imageUrl: '/clothing-learning/v2/watch.png', english: 'Watch', thai: 'นาฬิกาข้อมือ', phonetic: 'naa-li-gaa-khaw-mue' },
  { rosterId: '0392e0aa-343f-472e-9d3a-d0321a358ba9', imageUrl: '/clothing-learning/v2/backpack.png', english: 'Backpack', thai: 'กระเป๋าเป้', phonetic: 'gra-bpao-bpay' },
  { rosterId: '2f629bcc-4348-4be4-b00f-9c0f7dd3817a', imageUrl: '/clothing-learning/v2/umbrella.png', english: 'Umbrella', thai: 'ร่ม', phonetic: 'rom' },
] as const satisfies readonly (TeamLearningIdentity & { rosterId: string })[]
