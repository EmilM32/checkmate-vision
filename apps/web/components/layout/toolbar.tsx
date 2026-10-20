"use client"

import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  ChartLine,
  CircleHelp,
  Download,
  FlipVertical,
  Layers,
  MoveRight,
  RotateCcw,
} from "lucide-react"

import { HeatmapLegend } from "@/components/board/heatmap-overlay"
import { AnalysisLegend } from "@/components/layout/analysis-legend"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"

type ToolbarProps = {
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

// Icon buttons show their name in a tooltip on hover and focus, and expose
// it to assistive technology.
function WithTooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

export function Toolbar({ onExport, onNewAnalysis }: ToolbarProps) {
  const { t } = useI18n()
  const { state: uiState, dispatch } = useUI()

  const nextHeatmapMode = uiState.heatmapMode === "net" ? "split" : "net"
  const heatmapModeLabel =
    uiState.heatmapMode === "net"
      ? t("heatmap.modeNetShort")
      : t("heatmap.modeSplitShort")

  const isActive = (key: (typeof TOOLBAR_ITEMS)[number]["key"]) =>
    (key === "heatmap" && uiState.showHeatmap) ||
    (key === "arrows" && uiState.showArrows) ||
    (key === "chart" && uiState.showEvalChart) ||
    (key === "flip" && uiState.boardFlipped)

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {TOOLBAR_ITEMS.map(({ key, icon: Icon }) => (
        <WithTooltip key={key} label={t(`toolbar.${key}`)}>
          <Button
            variant={isActive(key) ? "secondary" : "ghost"}
            size="icon"
            className="size-8"
            aria-label={t(`toolbar.${key}`)}
            aria-pressed={key === "export" ? undefined : isActive(key)}
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
        </WithTooltip>
      ))}

      {uiState.showHeatmap ? (
        <WithTooltip label={t("heatmap.modeToggle")}>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-[11px] font-semibold tracking-wide uppercase"
            onClick={() => {
              dispatch({
                type: "UI_SET_HEATMAP_MODE",
                payload: nextHeatmapMode,
              })
            }}
          >
            {heatmapModeLabel}
          </Button>
        </WithTooltip>
      ) : null}

      <Popover>
        <WithTooltip label={t("help.open")}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("help.open")}
            >
              <CircleHelp className="size-4" />
            </Button>
          </PopoverTrigger>
        </WithTooltip>
        <PopoverContent
          side="top"
          align="end"
          className="max-h-[min(70svh,36rem)] space-y-4 overflow-y-auto"
        >
          <AnalysisLegend />
          <HeatmapLegend />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={onNewAnalysis}
      >
        <RotateCcw className="mr-1 size-4" />
        {t("common.new")}
      </Button>
    </div>
  )
}
