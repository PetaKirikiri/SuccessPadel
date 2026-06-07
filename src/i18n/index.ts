import type { AppLocale } from '../lib/locale'
import { en } from './en'
import { fr } from './fr'
import type { MessageParams, Messages } from './messages'
import { ru } from './ru'
import { th } from './th'

const catalogs: Record<AppLocale, Messages> = {
  en,
  th,
  fr,
  ru,
}

function getNested(obj: Messages, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key]
    return val != null ? String(val) : `{${key}}`
  })
}

export function createTranslator(locale: AppLocale) {
  const messages = catalogs[locale] ?? en

  function t(path: string, params?: MessageParams): string {
    const raw = getNested(messages, path) ?? getNested(en, path) ?? path
    return interpolate(raw, params)
  }

  return { t, messages }
}

export type TranslateFn = ReturnType<typeof createTranslator>['t']
