/** Presentation only: never select rules, timing, roster or scheduling by skin. */
export function competitionSkin(title: string | null | undefined): 'halloween' | 'superhero' {
  return /halloween|ฮาโลวีน|🎃/i.test(title ?? '') ? 'halloween' : 'superhero'
}
