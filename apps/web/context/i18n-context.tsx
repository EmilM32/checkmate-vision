"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

import {
  LOCALE_COOKIE_NAME,
  type Locale,
  isSupportedLocale,
} from "@/i18n/config"
import type { Dictionary } from "@/i18n/get-dictionary"

type TranslationValues = Record<string, string | number>

type I18nContextValue = {
  locale: Locale
  t: (key: string, values?: TranslationValues) => string
  setLocale: (nextLocale: Locale) => void
  isSwitchingLocale: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

function resolveKey(dictionary: Dictionary, key: string): string | null {
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, token) => (acc as Record<string, unknown>)?.[token],
      dictionary
    )

  return typeof value === "string" ? value : null
}

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template

  return Object.entries(values).reduce((output, [name, value]) => {
    return output.replaceAll(`{{${name}}}`, String(value))
  }, template)
}

export function I18nProvider({
  children,
  locale,
  dictionary,
}: {
  children: ReactNode
  locale: Locale
  dictionary: Dictionary
}) {
  const router = useRouter()
  const [isSwitchingLocale, startTransition] = useTransition()

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const resolved = resolveKey(dictionary, key)
      return interpolate(resolved ?? key, values)
    },
    [dictionary]
  )

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (!isSupportedLocale(nextLocale) || nextLocale === locale) {
        return
      }

      document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; samesite=lax`
      startTransition(() => {
        router.refresh()
      })
    },
    [locale, router]
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t, setLocale, isSwitchingLocale }),
    [locale, t, setLocale, isSwitchingLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18nContext(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18nContext must be used within I18nProvider")
  }
  return context
}
