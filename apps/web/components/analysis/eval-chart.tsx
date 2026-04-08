"use client"

import { useEffect, useRef, useState, type ComponentProps } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { formatEval } from "@/lib/engine/eval"

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

export function EvalChartPlaceholder() {
  const { t } = useI18n()
  const { state, goToMove } = useGame()
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.sleuthMode || engineState.sleuthRevealed
  const data = buildEvalChartData(state.history)
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
    label,
  }: {
    active?: boolean
    payload?: ReadonlyArray<{ payload: EvalChartPoint }>
    label?: string | number
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
          {t("analysis.move")} {label}
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
          {t("analysis.sleuthEvalHidden")}
        </div>
      ) : null}
      {containerSize.width > 0 && containerSize.height > 0 ? (
        analysisVisible ? (
          <AreaChart
            width={containerSize.width}
            height={containerSize.height}
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id="evalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="45%" stopColor="#10b981" stopOpacity={0.08} />
                <stop offset="55%" stopColor="#ef5350" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#ef5350" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
            <XAxis
              dataKey="moveIndex"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                value === 0 ? "0" : `${Math.ceil(value / 2)}`
              }
              minTickGap={20}
            />
            <YAxis
              domain={[-10, 10]}
              tickLine={false}
              axisLine={false}
              tickCount={5}
              tickFormatter={(value: number) => `${value}`}
              width={30}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }}
              content={renderTooltip as never}
            />
            <ReferenceLine
              y={0}
              stroke="#374151"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
            <ReferenceLine
              x={state.currentMoveIndex}
              stroke="#60a5fa"
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
            <Area
              type="monotone"
              dataKey="eval"
              stroke="#e5e7eb"
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
