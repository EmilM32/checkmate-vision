"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { useI18n } from "@/hooks/use-i18n"

/** Theme and language switches. */
export function Preferences() {
  const { locale, setLocale, isSwitchingLocale, t } = useI18n()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("theme.toggle")}
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {/* Both icons render; CSS picks one, so server and client
                markup match before the theme is known. */}
            <Moon className="size-3.5 dark:hidden" />
            <Sun className="hidden size-3.5 dark:block" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("theme.toggleHint")}</TooltipContent>
      </Tooltip>
      <div
        role="group"
        aria-label={t("language.label")}
        className="flex items-center"
      >
        {(["pl", "en"] as const).map((code) => (
          <Button
            key={code}
            variant={locale === code ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLocale(code)}
            disabled={isSwitchingLocale}
            aria-pressed={locale === code}
          >
            {t(`language.${code}`)}
          </Button>
        ))}
      </div>
    </div>
  )
}
