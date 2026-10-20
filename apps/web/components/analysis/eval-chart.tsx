"use client"

import { useEffect, useRef, useState, type ComponentProps } from "react"
import {
  Area,
  AreaChart,
  Dot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useGame } from "@/hooks/use-game"
import { useEngine } from "@/hooks/use-engine"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import {
  buildEvalChartData,
  type EvalChartPoint,
} from "@/lib/chess/eval-history"
import {
  CLASSIFICATION_LABEL_KEYS,
  CLASSIFICATION_COLORS,
} from "@/lib/chess/classification"
import {
  getMoveNumbering,
  getPlyColor,
  getPlyMoveNumber,
} from "@/lib/chess/move-numbering"
import { formatEval } from "@/lib/engine/eval"

const CHART_MARGIN_TOP = 8
const X_AXIS_HEIGHT = 24

function EvalDot(
  props: ComponentProps<typeof Dot> & { payload?: EvalChartPoint }
) {
  const { cx, cy, payload } = props

  if (typeof cx !== "number" || typeof cy !== "number" || !payload) {
    return null
  }

  const color = payload.classification
    ? CLASSIFICATION_COLORS[payload.classification]
    : "#6b7280"

  return <Dot cx={cx} cy={cy} r={3} fill={color} stroke={color} />
}

export function EvalChart() {
  const { t } = useI18n()
  const { state, goToMove } = useGame()
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed
  const data = buildEvalChartData(state.history, state.initialFen)
  const numbering = getMoveNumbering(state.initialFen)
  // One tick per full move (at White's ply), not one per ply.
  const moveTicks = data
    .filter(
      (point) =>
        point.moveIndex > 0 &&
        getPlyColor(point.moveIndex, numbering) === "white"
    )
    .map((point) => point.moveIndex)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const update = (width: number, height: number) => {
      const next = {
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
      }

      setContainerSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next
      )
    }

    update(node.clientWidth, node.clientHeight)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      update(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  const handleChartClick = (chartState: unknown) => {
    const clicked = (
      chartState as { activePayload?: Array<{ payload: EvalChartPoint }> }
    ).activePayload?.[0]?.payload
    if (!clicked) return
    goToMove(clicked.moveIndex)
  }

  const renderTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: ReadonlyArray<{ payload: EvalChartPoint }>
  }) => {
    if (!active || !payload?.length) return null
    const point = payload[0]?.payload
    if (!point) return null

    const evalLabel = point.rawScore ? formatEval(point.rawScore) : "0.0"
    const classificationLabel = point.classification
      ? t(CLASSIFICATION_LABEL_KEYS[point.classification])
      : t("analysis.noClassification")

    return (
      <div className="rounded border border-border/70 bg-background/95 px-2 py-1 text-xs shadow-sm">
        <div className="text-muted-foreground">
          {point.moveIndex === 0 ? `${t("analysis.move")} 0` : point.moveLabel}
        </div>
        <div className="font-medium">
          {t("analysis.eval")}: {evalLabel}
        </div>
        <div className="text-muted-foreground">{classificationLabel}</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-36 w-full min-w-0 overflow-hidden rounded-lg border border-border/50 p-2"
    >
      {!analysisVisible ? (
        <div className="flex h-full items-center justify-center rounded-md bg-muted/40 text-xs text-muted-foreground">
          {t("analysis.guessEvalHidden")}
        </div>
      ) : null}
      {containerSize.width > 0 && containerSize.height > 0 ? (
        analysisVisible ? (
          <AreaChart
            width={containerSize.width}
            height={containerSize.height}
            data={data}
            margin={{ top: CHART_MARGIN_TOP, right: 8, left: 8, bottom: 0 }}
            onClick={handleChartClick}
          >
            <defs>
              {/* Spans the plot area (top margin to the x-axis), so the
                  colour switches exactly at the 50% line: green where White
                  is better, red where Black is. */}
              <linearGradient
                id="evalFill"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={CHART_MARGIN_TOP}
                x2="0"
                y2={containerSize.height - X_AXIS_HEIGHT}
              >
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="50%" stopColor="#10b981" stopOpacity={0.08} />
                <stop offset="50%" stopColor="#ef5350" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#ef5350" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="moveIndex"
              height={X_AXIS_HEIGHT}
              ticks={moveTicks}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickFormatter={(value: number) =>
                value === 0 ? "0" : `${getPlyMoveNumber(value, numbering)}`
              }
              minTickGap={20}
            />
            {/* White's win chance: the midline is an equal game, the top
                a win for White. Exact evaluations are in the tooltip. */}
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeDasharray: "4 4",
              }}
              content={renderTooltip as never}
            />
            <ReferenceLine
              y={50}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />
            <ReferenceLine
              x={state.currentMoveIndex}
              stroke="#60a5fa"
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
            <Area
              type="monotone"
              baseValue={50}
              dataKey="winChance"
              stroke="var(--foreground)"
              strokeOpacity={0.7}
              strokeWidth={2}
              fill="url(#evalFill)"
              activeDot={{ r: 4 }}
              dot={<EvalDot />}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : null
      ) : null}
    </div>
  )
}
