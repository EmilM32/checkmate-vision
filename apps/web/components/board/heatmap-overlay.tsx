"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import { squareCenterUnits } from "@/lib/chess/board-coordinates"
import {
  buildHeatmap,
  buildSquareInfluence,
  type HeatmapCell,
} from "@/lib/chess/heatmap"

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

type PositionedInfluenceRay = {
  key: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: string
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
  const influenceDetails = useMemo(() => {
    if (!uiState.showHeatmap || !uiState.selectedInfluenceSquare) return null
    return buildSquareInfluence(gameState.fen, uiState.selectedInfluenceSquare)
  }, [gameState.fen, uiState.selectedInfluenceSquare, uiState.showHeatmap])

  const influenceRays = useMemo<PositionedInfluenceRay[]>(() => {
    if (
      !uiState.showHeatmap ||
      !uiState.showInfluenceTrace ||
      !uiState.selectedInfluenceSquare ||
      !influenceDetails
    ) {
      return []
    }

    const target = squareCenterUnits(
      uiState.selectedInfluenceSquare,
      uiState.boardFlipped
    )
    if (!target) return []

    const whiteRays = influenceDetails.whiteContributors.flatMap((entry) => {
      const from = squareCenterUnits(entry.fromSquare, uiState.boardFlipped)
      if (!from) return []

      return [
        {
          key: `w-${entry.fromSquare}-${uiState.selectedInfluenceSquare}`,
          fromX: from.x,
          fromY: from.y,
          toX: target.x,
          toY: target.y,
          color: HEATMAP_COLORS.white,
        },
      ]
    })

    const blackRays = influenceDetails.blackContributors.flatMap((entry) => {
      const from = squareCenterUnits(entry.fromSquare, uiState.boardFlipped)
      if (!from) return []

      return [
        {
          key: `b-${entry.fromSquare}-${uiState.selectedInfluenceSquare}`,
          fromX: from.x,
          fromY: from.y,
          toX: target.x,
          toY: target.y,
          color: HEATMAP_COLORS.black,
        },
      ]
    })

    return [...whiteRays, ...blackRays]
  }, [
    influenceDetails,
    uiState.boardFlipped,
    uiState.selectedInfluenceSquare,
    uiState.showHeatmap,
    uiState.showInfluenceTrace,
  ])

  const selectedTargetPoint = useMemo(() => {
    if (!uiState.showHeatmap || !uiState.selectedInfluenceSquare) return null

    return squareCenterUnits(
      uiState.selectedInfluenceSquare,
      uiState.boardFlipped
    )
  }, [
    uiState.boardFlipped,
    uiState.selectedInfluenceSquare,
    uiState.showHeatmap,
  ])

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
                    fontSize="0.27"
                    fontWeight="700"
                    fill={HEATMAP_COLORS.label}
                    stroke={HEATMAP_COLORS.labelStroke}
                    strokeWidth="0.05"
                    paintOrder="stroke"
                  >
                    {cell.label}
                  </text>
                ) : null}
              </motion.g>
            )
          })}

          {selectedTargetPoint ? (
            <motion.g
              key={`selected-target-${uiState.selectedInfluenceSquare}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <rect
                x={selectedTargetPoint.x - 0.5}
                y={selectedTargetPoint.y - 0.5}
                width={1}
                height={1}
                fill="none"
                stroke="rgba(56, 189, 248, 0.95)"
                strokeWidth="0.07"
                strokeDasharray="0.18 0.1"
              />
              <motion.circle
                cx={selectedTargetPoint.x}
                cy={selectedTargetPoint.y}
                r={0.24}
                fill="none"
                stroke="rgba(56, 189, 248, 0.9)"
                strokeWidth="0.07"
                animate={{ opacity: [0.95, 0.35, 0.95], r: [0.2, 0.34, 0.2] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <circle
                cx={selectedTargetPoint.x}
                cy={selectedTargetPoint.y}
                r={0.09}
                fill="rgba(56, 189, 248, 0.95)"
                opacity={0.85}
              />
            </motion.g>
          ) : null}

          {influenceRays.map((ray) => (
            <motion.g
              key={ray.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <line
                x1={ray.fromX}
                y1={ray.fromY}
                x2={ray.toX}
                y2={ray.toY}
                stroke={ray.color}
                strokeOpacity={0.45}
                strokeWidth={0.055}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeDasharray="0.14 0.1"
              />
              <circle
                cx={ray.fromX}
                cy={ray.fromY}
                r={0.06}
                fill={ray.color}
                opacity={0.5}
              />
            </motion.g>
          ))}
        </motion.svg>
      ) : null}
    </AnimatePresence>
  )
}

export function HeatmapLegend() {
  const { state: uiState } = useUI()
  const { state: gameState } = useGame()
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
  const influenceDetails = useMemo(() => {
    if (!uiState.showHeatmap || !uiState.selectedInfluenceSquare) return null
    return buildSquareInfluence(gameState.fen, uiState.selectedInfluenceSquare)
  }, [gameState.fen, uiState.selectedInfluenceSquare, uiState.showHeatmap])

  return (
    <div className="w-full overflow-y-auto rounded-md border border-border/70 bg-background/88 p-3 text-[11px] shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          {t("toolbar.heatmap")}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {modeLabel}
        </span>
      </div>

      <p className="mt-2 leading-tight text-muted-foreground">{modeHint}</p>

      <div className="mt-3 rounded-md border border-border/60 bg-muted/25 p-2 text-[10px] leading-snug text-muted-foreground">
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

      <div className="mt-3 flex flex-col gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-emerald-600/80" />
          <span>{t("heatmap.whitePressure")}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-red-600/80" />
          <span>{t("heatmap.blackPressure")}</span>
        </span>
      </div>

      <div className="mt-3 rounded-md border border-border/60 bg-muted/25 p-2 text-[10px] leading-snug text-muted-foreground">
        <p className="font-semibold text-foreground">
          {t("heatmap.traceTitle")}
        </p>
        {uiState.selectedInfluenceSquare && influenceDetails ? (
          <>
            <p className="mt-1">
              {t("heatmap.traceSelected", {
                square: uiState.selectedInfluenceSquare,
              })}
            </p>
            <p className="mt-1">
              {t("heatmap.traceWhiteContrib", {
                count: influenceDetails.whiteControl,
              })}
            </p>
            <p className="mt-1">
              {t("heatmap.traceBlackContrib", {
                count: influenceDetails.blackControl,
              })}
            </p>
            <p className="mt-1">
              {t("heatmap.traceNet", { balance: influenceDetails.balance })}
            </p>
          </>
        ) : (
          <p className="mt-1">{t("heatmap.traceHint")}</p>
        )}

        <p className="mt-1">{t("heatmap.traceKeyboardHint")}</p>
        {!uiState.showInfluenceTrace ? (
          <p className="mt-1">{t("heatmap.traceHidden")}</p>
        ) : null}
      </div>
    </div>
  )
}
