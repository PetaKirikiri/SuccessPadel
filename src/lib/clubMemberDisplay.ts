/** Real member — LINE name is Thai; foreigners know him as Bia. */
export const BIA_PROFILE_ID = 'f5384b42-d681-4b49-90aa-926d6f34e1f4'
export const BIA_LINE_USER_ID = 'U2131aeeeaaa787589d757995fb667e07'
export const PETER_P_PROFILE_ID = 'f1410e7c-30c2-4f95-ac84-36737c587134'

export function clubDisplayName(profileId: string | null | undefined, name: string): string {
  if (profileId === BIA_PROFILE_ID) return 'Bia'
  if (profileId === PETER_P_PROFILE_ID) return 'Peter P'
  return name
}

export function clubDisplayNameFromLine(
  lineUserId: string | null | undefined,
  name: string | null | undefined,
): string | null | undefined {
  if (lineUserId === BIA_LINE_USER_ID) return 'Bia'
  return name
}
