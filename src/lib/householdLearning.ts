import type { TeamLearningIdentity } from './spiritAnimals'

export const HOUSEHOLD_COMPETITION_ID = '9428fda9-2e62-4ee9-a5aa-79cfeaf84c71'

export const HOUSEHOLD_SLOT_IDENTITIES = [
  {"rosterId": "7d661666-7c81-46e5-bccc-c1638a29cc37", "imageUrl": "/household-learning/window.png", "english": "Window", "thai": "หน้าต่าง", "phonetic": "naa-dtaang"},
  {"rosterId": "f874e369-4e37-4650-a58b-97c1904ecfd1", "imageUrl": "/household-learning/curtain.png", "english": "Curtain", "thai": "ผ้าม่าน", "phonetic": "phaa-maan"},
  {"rosterId": "db847343-9fa5-4ae3-b08a-f9776b6098e4", "imageUrl": "/household-learning/door.png", "english": "Door", "thai": "ประตู", "phonetic": "bpra-dtoo"},
  {"rosterId": "acf3bf3f-ee7a-4c57-bf13-72bd9c9e1c4f", "imageUrl": "/household-learning/shower.png", "english": "Shower", "thai": "ฝักบัว", "phonetic": "fak-bua"},
  {"rosterId": "5ea3f58d-7e5a-475b-b09b-4f6837aa7434", "imageUrl": "/household-learning/light.png", "english": "Light", "thai": "ไฟ", "phonetic": "fai"},
  {"rosterId": "4d50179a-b0e1-4913-93a3-5af6895a5d84", "imageUrl": "/household-learning/mirror.png", "english": "Mirror", "thai": "กระจก", "phonetic": "gra-jok"},
  {"rosterId": "1f3498f5-8786-4951-aa66-15c1f6e5b8d2", "imageUrl": "/household-learning/sink.png", "english": "Sink", "thai": "อ่างล้างมือ", "phonetic": "aang-laang-mue"},
  {"rosterId": "a16805eb-13d3-4551-8510-483b1d9e27f9", "imageUrl": "/household-learning/clock.png", "english": "Clock", "thai": "นาฬิกา", "phonetic": "naa-li-gaa"},
  {"rosterId": "4cf3d49e-1d17-4997-b8b0-c061ba2f3e62", "imageUrl": "/household-learning/bathtub.png", "english": "Bathtub", "thai": "อ่างอาบน้ำ", "phonetic": "aang-aap-naam"},
  {"rosterId": "9d7ed65e-cffa-44fb-aa9a-360de38051c4", "imageUrl": "/household-learning/sofa.png", "english": "Sofa", "thai": "โซฟา", "phonetic": "soh-faa"},
  {"rosterId": "c41be12f-7a8a-445b-8702-7a13a6fd971e", "imageUrl": "/household-learning/bed.png", "english": "Bed", "thai": "เตียง", "phonetic": "dtiang"},
  {"rosterId": "2f73b0b8-dc09-45e7-bb39-c654e0ba1552", "imageUrl": "/household-learning/pillow.png", "english": "Pillow", "thai": "หมอน", "phonetic": "mawn"},
  {"rosterId": "003a1579-c8ab-4350-9cce-0b4c66101d0d", "imageUrl": "/household-learning/wardrobe.png", "english": "Wardrobe", "thai": "ตู้เสื้อผ้า", "phonetic": "dtoo-suea-phaa"},
  {"rosterId": "02a3cae9-8a25-44c4-9c88-961e87d45403", "imageUrl": "/household-learning/fan.png", "english": "Fan", "thai": "พัดลม", "phonetic": "phat-lom"},
  {"rosterId": "d101edfc-bb73-4721-9735-93c4bd828dcc", "imageUrl": "/household-learning/stairs.png", "english": "Stairs", "thai": "บันได", "phonetic": "ban-dai"},
  {"rosterId": "9b4ee57c-73aa-4d2d-983f-d147384361f5", "imageUrl": "/household-learning/roof.png", "english": "Roof", "thai": "หลังคา", "phonetic": "lang-khaa"},
] as const satisfies readonly (TeamLearningIdentity & { rosterId: string })[]

/** Event-owned session_players IDs; never names, profiles, rank or current partner. */
export function learningIdentityForSlot(rosterId: string | null | undefined): TeamLearningIdentity | null {
  return HOUSEHOLD_SLOT_IDENTITIES.find((slot) => slot.rosterId === rosterId) ?? null
}
