"use client"

import { Button } from "@workspace/ui/components/button"
import {
  ChartLine,
  Download,
  Eye,
  FlipVertical,
  Layers,
  MoveRight,
  RotateCcw,
  Search,
} from "lucide-react"

import { useEngine } from "@/hooks/use-engine"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"

type ToolbarPlaceholderProps = {
  onExport: () => void
  onNewAnalysis: () => void
}

// TODO: Przyciski narzedzi
// - Heatmap: toggle UIContext.showHeatmap — wlacza/wylacza nakladke kontroli pol
// - Arrows: toggle UIContext.showArrows — wlacza/wylacza strzalki najlepszych ruchow
// - Sleuth: toggle UIContext.sleuthMode — tryb zgadywania (ukrywa najlepszy ruch, gracz probuje sam)
// - Export: html-to-image -> zapis aktualnej pozycji jako PNG
// - Flip: toggle UIContext.boardFlipped — odwraca szachownice (bialy/czarny na dole)
const TOOLBAR_ITEMS = [
  { key: "heatmap", icon: Layers },
  { key: "arrows", icon: MoveRight },
  { key: "sleuth", icon: Search },
  { key: "chart", icon: ChartLine },
  { key: "export", icon: Download },
  { key: "flip", icon: FlipVertical },
] as const

export function ToolbarPlaceholder({
  onExport,
  onNewAnalysis,
}: ToolbarPlaceholderProps) {
  const { locale, setLocale, isSwitchingLocale, t } = useI18n()
  const { state: uiState, dispatch } = useUI()
  const { state: engineState, revealAnalysis, concealAnalysis } = useEngine()

  const isRevealAvailable = uiState.sleuthMode && !engineState.sleuthRevealed

  return (
    <div className="flex items-center gap-1.5">
      {TOOLBAR_ITEMS.map(({ key, icon: Icon }) => (
        <Button
          key={key}
          variant={
            key === "heatmap" && uiState.showHeatmap
              ? "secondary"
              : key === "arrows" && uiState.showArrows
                ? "secondary"
                : key === "sleuth" && uiState.sleuthMode
                  ? "secondary"
                  : key === "chart" && uiState.showEvalChart
                    ? "secondary"
                    : key === "flip" && uiState.boardFlipped
                      ? "secondary"
                      : "ghost"
          }
          size="icon"
          className="size-8"
          title={t(`toolbar.${key}`)}
          onClick={() => {
            if (key === "heatmap") {
              dispatch({ type: "UI_TOGGLE_HEATMAP" })
              return
            }

            if (key === "arrows") {
              dispatch({ type: "UI_TOGGLE_ARROWS" })
              return
            }

            if (key === "sleuth") {
              concealAnalysis()
              dispatch({ type: "UI_TOGGLE_SLEUTH_MODE" })
              return
            }

            if (key === "chart") {
              dispatch({ type: "UI_TOGGLE_EVAL_CHART" })
              return
            }

            if (key === "export") {
              onExport()
              return
            }

            if (key === "flip") {
              dispatch({ type: "UI_TOGGLE_BOARD_FLIPPED" })
            }
          }}
        >
          <Icon className="size-4" />
        </Button>
      ))}

      <Button
        variant={engineState.sleuthRevealed ? "secondary" : "outline"}
        size="sm"
        className="h-8"
        disabled={!isRevealAvailable}
        onClick={revealAnalysis}
      >
        <Eye className="mr-1 size-4" />
        {t("common.reveal")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={onNewAnalysis}
      >
        <RotateCcw className="mr-1 size-4" />
        {t("common.new")}
      </Button>

      <div className="ml-1 flex items-center gap-1">
        <Button
          variant={locale === "pl" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2"
          onClick={() => setLocale("pl")}
          disabled={isSwitchingLocale}
          aria-label={t("language.label")}
        >
          {t("language.pl")}
        </Button>
        <Button
          variant={locale === "en" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2"
          onClick={() => setLocale("en")}
          disabled={isSwitchingLocale}
          aria-label={t("language.label")}
        >
          {t("language.en")}
        </Button>
      </div>
    </div>
  )
}
