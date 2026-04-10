"use client"

import { Button } from "@workspace/ui/components/button"
import {
  ChartLine,
  Download,
  FlipVertical,
  Layers,
  MoveRight,
  RotateCcw,
} from "lucide-react"

import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"

type ToolbarPlaceholderProps = {
  onExport: () => void
  onNewAnalysis: () => void
}

const TOOLBAR_ITEMS = [
  { key: "heatmap", icon: Layers },
  { key: "arrows", icon: MoveRight },
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

  const nextHeatmapMode = uiState.heatmapMode === "net" ? "split" : "net"
  const heatmapModeLabel =
    uiState.heatmapMode === "net"
      ? t("heatmap.modeNetShort")
      : t("heatmap.modeSplitShort")

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

      {uiState.showHeatmap ? (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-[11px] font-semibold tracking-wide uppercase"
          title={t("heatmap.modeToggle")}
          onClick={() => {
            dispatch({ type: "UI_SET_HEATMAP_MODE", payload: nextHeatmapMode })
          }}
        >
          {heatmapModeLabel}
        </Button>
      ) : null}

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
