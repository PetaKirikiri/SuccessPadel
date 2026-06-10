/** Real member — LINE name is Thai; foreigners know him as Bia. */
export const BIA_PROFILE_ID = 'f5384b42-d681-4b49-90aa-926d6f34e1f4'
export const BIA_LINE_USER_ID = 'U2131aeeeaaa787589d757995fb667e07'

export function clubDisplayName(profileId: string | null | undefined, name: string): string {
  if (profileId === BIA_PROFILE_ID) return 'Bia'
  return name
}

export function clubDisplayNameFromLine(
  lineUserId: string | null | undefined,
  name: string | null | undefined,
): string | null | undefined {
  if (lineUserId === BIA_LINE_USER_ID) return 'Bia'
  return name
}
