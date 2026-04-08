// TODO: Pasek informacji o graczu
// - Avatar (zdjecie/inicjaly), nick, rating (ELO)
// - Zegar szachowy (odliczanie czasu, formatowanie mm:ss)
// - Zbite figury przeciwnika (material advantage)
// - Dane z GameContext (players, clocks)
import { useI18n } from "@/hooks/use-i18n"

export function PlayerBarPlaceholder({ color }: { color: "white" | "black" }) {
  const { t } = useI18n()

  return (
    <div className="flex w-full items-center justify-between px-1 py-1.5">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-full bg-muted" />
        <span className="text-sm font-medium text-foreground">
          {color === "white" ? t("common.white") : t("common.black")}
        </span>
      </div>
      <span className="font-mono text-sm text-muted-foreground">10:00</span>
    </div>
  )
}
