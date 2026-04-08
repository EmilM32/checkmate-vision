import { cookies, headers } from "next/headers"

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type Locale,
  isSupportedLocale,
} from "@/i18n/config"

function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return []

  return header
    .split(",")
    .map((part) => {
      const [lang, weightPart] = part.trim().split(";")
      const q = weightPart?.startsWith("q=")
        ? Number.parseFloat(weightPart.slice(2))
        : 1

      return {
        lang: lang?.toLowerCase() ?? "",
        q: Number.isFinite(q) ? q : 0,
      }
    })
    .filter((entry) => entry.lang)
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.lang)
}

export async function resolveRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value

  if (cookieLocale && isSupportedLocale(cookieLocale)) {
    return cookieLocale
  }

  const headerStore = await headers()
  const accepted = parseAcceptLanguage(headerStore.get("accept-language"))

  for (const language of accepted) {
    const base = language.split("-")[0]
    if (base && isSupportedLocale(base)) {
      return base
    }
  }

  return DEFAULT_LOCALE
}
