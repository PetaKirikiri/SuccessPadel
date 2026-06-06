export type GuestEntry = { name: string; email: string | null }

export function parseGuestLines(text: string): GuestEntry[] {
  return text
    .split('\n')
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim())
      const name = parts[0] ?? ''
      const email = parts[1] ? parts[1].toLowerCase() : null
      return { name, email: email || null }
    })
    .filter((g) => g.name.length > 0)
}
