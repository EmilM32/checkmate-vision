"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import { squareCenterUnits } from "@/lib/chess/board-coordinates"
import { buildHeatmap, type HeatmapCell } from "@/lib/chess/heatmap"

const HEATMAP_COLORS = {
  white: "#16a34a",
  black: "#dc2626",
  neutral: "#cbd5e1",
  label: "#f8fafc",
  labelStroke: "rgba(15, 23, 42, 0.78)",
} as const

type PositionedCell = {
  key: string
  x: number
  y: number
  centerX: number
  centerY: number
  side: HeatmapCell["side"]
  balance: number
  whiteControl: number
  blackControl: number
  tintOpacity: number
  markerWeight: number
  label: string | null
}

function scaleRelative(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0
  return Math.sqrt(value / maxValue)
}

function buildCellLabel(
  cell: HeatmapCell,
  mode: "net" | "split"
): string | null {
  if (mode === "split") {
    if (cell.whiteControl === 0 && cell.blackControl === 0) return null
    const totalControl = cell.whiteControl + cell.blackControl
    if (totalControl < 2 && !(cell.whiteControl > 0 && cell.blackControl > 0)) {
      return null
    }
    return `${cell.whiteControl}:${cell.blackControl}`
  }

  if (Math.abs(cell.balance) < 2) return null
  return cell.balance > 0 ? `+${cell.balance}` : `${cell.balance}`
}

function getSquareColor(
  cell: Pick<HeatmapCell, "side" | "whiteControl" | "blackControl">,
  mode: "net" | "split"
): string {
  if (mode === "split" && cell.whiteControl > 0 && cell.blackControl > 0) {
    return HEATMAP_COLORS.neutral
  }

  if (cell.side === "neutral") {
    return HEATMAP_COLORS.neutral
  }

  return HEATMAP_COLORS[cell.side]
}

export function HeatmapOverlay() {
  const { state: gameState } = useGame()
  const { state: uiState } = useUI()

  const cells = useMemo(() => buildHeatmap(gameState.fen), [gameState.fen])

  const metrics = useMemo(() => {
    return cells.reduce(
      (acc, cell) => ({
        maxBalance: Math.max(acc.maxBalance, Math.abs(cell.balance)),
        maxControl: Math.max(
          acc.maxControl,
          cell.whiteControl,
          cell.blackControl
        ),
      }),
      { maxBalance: 1, maxControl: 1 }
    )
  }, [cells])

  const positionedCells = useMemo<PositionedCell[]>(() => {
    return cells.flatMap((cell) => {
      const shouldRender =
        uiState.heatmapMode === "split"
          ? cell.whiteControl > 0 || cell.blackControl > 0
          : cell.balance !== 0

      if (!shouldRender) return []

      const center = squareCenterUnits(cell.square, uiState.boardFlipped)
      if (!center) return []

      const markerWeight =
        uiState.heatmapMode === "split"
          ? scaleRelative(
              Math.max(cell.whiteControl, cell.blackControl),
              metrics.maxControl
            )
          : scaleRelative(Math.abs(cell.balance), metrics.maxBalance)

      return [
        {
          key: cell.square,
          x: center.x - 0.5,
          y: center.y - 0.5,
          centerX: center.x,
          centerY: center.y,
          side: cell.side,
          balance: cell.balance,
          whiteControl: cell.whiteControl,
          blackControl: cell.blackControl,
          markerWeight,
          tintOpacity:
            uiState.heatmapMode === "split"
              ? 0.04 + markerWeight * 0.1
              : 0.05 + markerWeight * 0.14,
          label: buildCellLabel(cell, uiState.heatmapMode),
        },
      ]
    })
  }, [
    cells,
    metrics.maxBalance,
    metrics.maxControl,
    uiState.boardFlipped,
    uiState.heatmapMode,
  ])

  const shouldShow = uiState.showHeatmap && positionedCells.length > 0

  return (
    <AnimatePresence>
      {shouldShow ? (
        <motion.svg
          key="heatmap-overlay"
          className="board-overlay board-overlay-heatmap size-full"
          viewBox="0 0 8 8"
          preserveAspectRatio="none"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {positionedCells.map((cell) => {
            const color = getSquareColor(cell, uiState.heatmapMode)
            const primaryRadius = 0.16 + cell.markerWeight * 0.2
            const whiteRadius =
              0.08 + scaleRelative(cell.whiteControl, metrics.maxControl) * 0.16
            const blackRadius =
              0.08 + scaleRelative(cell.blackControl, metrics.maxControl) * 0.16

            return (
              <motion.g
                key={cell.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={1}
                  height={1}
                  fill={color}
                  opacity={cell.tintOpacity}
                />

                {uiState.heatmapMode === "split" ? (
                  <>
                    {cell.whiteControl > 0 ? (
                      <circle
                        cx={cell.centerX - 0.15}
                        cy={cell.centerY}
                        r={whiteRadius}
                        fill={HEATMAP_COLORS.white}
                        opacity={
                          0.28 +
                          scaleRelative(cell.whiteControl, metrics.maxControl) *
                            0.42
                        }
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={0.035}
                      />
                    ) : null}
                    {cell.blackControl > 0 ? (
                      <circle
                        cx={cell.centerX + 0.15}
                        cy={cell.centerY}
                        r={blackRadius}
                        fill={HEATMAP_COLORS.black}
                        opacity={
                          0.28 +
                          scaleRelative(cell.blackControl, metrics.maxControl) *
                            0.42
                        }
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={0.035}
                      />
                    ) : null}
                  </>
                ) : (
                  <circle
                    cx={cell.centerX}
                    cy={cell.centerY}
                    r={primaryRadius}
                    fill={color}
                    opacity={0.24 + cell.markerWeight * 0.42}
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth={0.04}
                  />
                )}

                {cell.label ? (
                  <text
                    x={cell.centerX}
                    y={cell.centerY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="0.21"
                    fontWeight="700"
                    fill={HEATMAP_COLORS.label}
                    stroke={HEATMAP_COLORS.labelStroke}
                    strokeWidth="0.04"
                    paintOrder="stroke"
                  >
                    {cell.label}
                  </text>
                ) : null}
              </motion.g>
            )
          })}
        </motion.svg>
      ) : null}
    </AnimatePresence>
  )
}

export function HeatmapLegend() {
  const { state: uiState } = useUI()
  const { t } = useI18n()

  if (!uiState.showHeatmap) return null

  const modeLabel =
    uiState.heatmapMode === "net"
      ? t("heatmap.modeNet")
      : t("heatmap.modeSplit")
  const modeHint =
    uiState.heatmapMode === "net"
      ? t("heatmap.netHint")
      : t("heatmap.splitHint")
  const modeExample =
    uiState.heatmapMode === "net"
      ? t("heatmap.netExample")
      : t("heatmap.splitExample")

  return (
    <div className="w-full overflow-y-auto rounded-md border border-border/70 bg-background/88 p-3 text-[10px] shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          {t("toolbar.heatmap")}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
          {modeLabel}
        </span>
      </div>

      <p className="mt-2 leading-tight text-muted-foreground">{modeHint}</p>

      <div className="mt-3 rounded-md border border-border/60 bg-muted/25 p-2 text-[9px] leading-tight text-muted-foreground">
        <p className="font-semibold text-foreground">
          {t("heatmap.valueGuideTitle")}
        </p>
        <p className="mt-1">{t("heatmap.valueGuideBody")}</p>
        <p className="mt-1">
          <span className="font-semibold text-emerald-400">+4:</span>{" "}
          {t("heatmap.valuePlusExample")}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-red-400">-5:</span>{" "}
          {t("heatmap.valueMinusExample")}
        </p>
        <p className="mt-1">{modeExample}</p>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-emerald-600/80" />
          <span>{t("heatmap.whitePressure")}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-red-600/80" />
          <span>{t("heatmap.blackPressure")}</span>
        </span>
      </div>
    </div>
  )
}
