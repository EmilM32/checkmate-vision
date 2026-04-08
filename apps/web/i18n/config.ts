export const LOCALE_COOKIE_NAME = "cv_locale"
export const DEFAULT_LOCALE = "pl"

export const SUPPORTED_LOCALES = ["pl", "en"] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}
