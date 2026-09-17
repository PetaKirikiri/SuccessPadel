/** Presentation only. Never use this to identify accounts or rewrite LINE data. */
export function playerDisplayName(name: string | null | undefined): string {
  return (name ?? '')
    // Match whole keycaps and emoji sequences, including flags, skin tones,
    // variation selectors and joined families. Keep Thai marks and real digits.
    .replace(/[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}](?:[\uFE0E\uFE0F\p{Emoji_Modifier}\u{E0020}-\u{E007F}]|\u200D[\p{Extended_Pictographic}\p{Emoji_Modifier}])*/gu, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Player'
}
