export type MemberContacts = { id: string; line_contact_url: string | null; whatsapp_number: string | null }

export function normalizeWhatsApp(value: string): string | null {
  if (!value.trim()) return null
  if (!/^\+?[\d\s().-]+$/.test(value.trim())) throw new Error('Use an international number, e.g. +66 81 234 5678.')
  const digits = value.replace(/[^\d]/g, '')
  if (!/^[1-9]\d{6,14}$/.test(digits)) throw new Error('Include the country code, e.g. +66 81 234 5678.')
  return digits
}
export function normalizeLineContact(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // A LINE login user ID is not a shareable personal contact URL.
  if (!/^https:\/\/(?:line\.me\/(?:R\/)?ti\/p\/[^\s?#]+|lin\.ee\/[A-Za-z0-9_-]+)$/.test(trimmed) || trimmed.length > 512) {
    throw new Error('Paste their LINE profile link from My QR code → Copy link.')
  }
  return trimmed
}
export function whatsAppContactUrl(number: string | null | undefined): string | null {
  return number && /^[1-9]\d{6,14}$/.test(number) ? `https://wa.me/${number}` : null
}
