export type CountryOption = {
  code: string
  name: string
  flag: string
  label: string
}

const COUNTRY_CODES = [
  'AF',
  'AX',
  'AL',
  'DZ',
  'AS',
  'AD',
  'AO',
  'AI',
  'AQ',
  'AG',
  'AR',
  'AM',
  'AW',
  'AU',
  'AT',
  'AZ',
  'BS',
  'BH',
  'BD',
  'BB',
  'BY',
  'BE',
  'BZ',
  'BJ',
  'BM',
  'BT',
  'BO',
  'BQ',
  'BA',
  'BW',
  'BR',
  'IO',
  'BN',
  'BG',
  'BF',
  'BI',
  'CV',
  'KH',
  'CM',
  'CA',
  'KY',
  'CF',
  'TD',
  'CL',
  'CN',
  'CX',
  'CC',
  'CO',
  'KM',
  'CG',
  'CD',
  'CK',
  'CR',
  'CI',
  'HR',
  'CU',
  'CW',
  'CY',
  'CZ',
  'DK',
  'DJ',
  'DM',
  'DO',
  'EC',
  'EG',
  'SV',
  'GQ',
  'ER',
  'EE',
  'SZ',
  'ET',
  'FK',
  'FO',
  'FJ',
  'FI',
  'FR',
  'GF',
  'PF',
  'TF',
  'GA',
  'GM',
  'GE',
  'DE',
  'GH',
  'GI',
  'GR',
  'GL',
  'GD',
  'GP',
  'GU',
  'GT',
  'GG',
  'GN',
  'GW',
  'GY',
  'HT',
  'HN',
  'HK',
  'HU',
  'IS',
  'IN',
  'ID',
  'IR',
  'IQ',
  'IE',
  'IM',
  'IL',
  'IT',
  'JM',
  'JP',
  'JE',
  'JO',
  'KZ',
  'KE',
  'KI',
  'KP',
  'KR',
  'KW',
  'KG',
  'LA',
  'LV',
  'LB',
  'LS',
  'LR',
  'LY',
  'LI',
  'LT',
  'LU',
  'MO',
  'MG',
  'MW',
  'MY',
  'MV',
  'ML',
  'MT',
  'MH',
  'MQ',
  'MR',
  'MU',
  'YT',
  'MX',
  'FM',
  'MD',
  'MC',
  'MN',
  'ME',
  'MS',
  'MA',
  'MZ',
  'MM',
  'NA',
  'NR',
  'NP',
  'NL',
  'NC',
  'NZ',
  'NI',
  'NE',
  'NG',
  'NU',
  'NF',
  'MK',
  'MP',
  'NO',
  'OM',
  'PK',
  'PW',
  'PS',
  'PA',
  'PG',
  'PY',
  'PE',
  'PH',
  'PN',
  'PL',
  'PT',
  'PR',
  'QA',
  'RE',
  'RO',
  'RU',
  'RW',
  'BL',
  'SH',
  'KN',
  'LC',
  'MF',
  'PM',
  'VC',
  'WS',
  'SM',
  'ST',
  'SA',
  'SN',
  'RS',
  'SC',
  'SL',
  'SG',
  'SX',
  'SK',
  'SI',
  'SB',
  'SO',
  'ZA',
  'GS',
  'SS',
  'ES',
  'LK',
  'SD',
  'SR',
  'SJ',
  'SE',
  'CH',
  'SY',
  'TW',
  'TJ',
  'TZ',
  'TH',
  'TL',
  'TG',
  'TK',
  'TO',
  'TT',
  'TN',
  'TR',
  'TM',
  'TC',
  'TV',
  'UG',
  'UA',
  'AE',
  'GB',
  'US',
  'UM',
  'UY',
  'UZ',
  'VU',
  'VA',
  'VE',
  'VN',
  'VG',
  'VI',
  'WF',
  'EH',
  'YE',
  'ZM',
  'ZW',
] as const

const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  BO: 'Bolivia',
  CD: 'Congo (DRC)',
  CG: 'Congo',
  CI: "Cote d'Ivoire",
  CZ: 'Czechia',
  FK: 'Falkland Islands',
  FM: 'Micronesia',
  GB: 'United Kingdom',
  IR: 'Iran',
  KP: 'North Korea',
  KR: 'South Korea',
  LA: 'Laos',
  MD: 'Moldova',
  MK: 'North Macedonia',
  PS: 'Palestine',
  RU: 'Russia',
  SY: 'Syria',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  US: 'United States',
  VA: 'Vatican City',
  VE: 'Venezuela',
  VN: 'Vietnam',
}

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

function countryName(code: string): string {
  const normalized = code.toUpperCase()
  return COUNTRY_NAME_OVERRIDES[normalized] ?? regionNames?.of(normalized) ?? normalized
}

export const COUNTRY_OPTIONS: CountryOption[] = COUNTRY_CODES.map((code) => {
  const name = countryName(code)
  const flag = countryFlag(code)
  return {
    code,
    name,
    flag,
    label: `${flag} ${name}`,
  }
}).sort((a, b) => a.name.localeCompare(b.name))

const COUNTRY_BY_CODE = new Map(COUNTRY_OPTIONS.map((country) => [country.code, country]))
const COUNTRY_BY_NAME = new Map(
  COUNTRY_OPTIONS.map((country) => [country.name.toLowerCase(), country]),
)

export function countryOptionFromValue(value: string | null | undefined): CountryOption | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const codeMatch = COUNTRY_BY_CODE.get(trimmed.toUpperCase())
  if (codeMatch) return codeMatch
  return COUNTRY_BY_NAME.get(trimmed.toLowerCase()) ?? null
}

export function countryLabel(value: string | null | undefined): string | null {
  const option = countryOptionFromValue(value)
  return option?.label ?? value?.trim() ?? null
}

function countrySearchText(country: CountryOption): string {
  return `${country.code} ${country.name} ${country.label}`.toLowerCase()
}

export function searchCountries(query: string, limit = 12): CountryOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return COUNTRY_OPTIONS.slice(0, limit)

  const startsWith: CountryOption[] = []
  const includes: CountryOption[] = []

  for (const country of COUNTRY_OPTIONS) {
    const code = country.code.toLowerCase()
    const name = country.name.toLowerCase()
    if (code.startsWith(q) || name.startsWith(q)) {
      startsWith.push(country)
    } else if (countrySearchText(country).includes(q)) {
      includes.push(country)
    }
  }

  return [...startsWith, ...includes].slice(0, limit)
}
