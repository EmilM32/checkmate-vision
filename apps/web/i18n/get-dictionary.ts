import "server-only"

import en from "@/i18n/dictionaries/en.json"
import pl from "@/i18n/dictionaries/pl.json"
import type { Locale } from "@/i18n/config"

export type Dictionary = typeof en

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  pl,
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
