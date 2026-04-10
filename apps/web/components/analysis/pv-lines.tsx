"use client"

import { useMemo } from "react"
import { Chess } from "chess.js"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import type { EngineScore } from "@/context/engine-context"

function uciToSan(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen)
  const san: string[] = []
  for (const uci of uciMoves) {
    try {
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci.length > 4 ? uci[4] : undefined
      const move = chess.move({ from, to, promotion })
      san.push(move.san)
    } catch {
      break
    }
  }
  return san
}

function formatScore(score: EngineScore | null): string {
  if (!score) return "—"
  if (score.type === "mate") {
    const sign = score.value > 0 ? "+" : ""
    return `M${sign}${score.value}`
  }
  const value = score.value / 100
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
}

function scoreColorClass(score: EngineScore | null): string {
  if (!score) return "text-muted-foreground"
  if (score.type === "mate")
    return score.value > 0 ? "text-emerald-500" : "text-red-500"
  if (score.value > 50) return "text-emerald-500"
  if (score.value < -50) return "text-red-500"
  return "text-muted-foreground"
}

export function PVLines() {
  const { t } = useI18n()
  const { state: engineState } = useEngine()
  const { state: gameState } = useGame()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed

  const linesWithSan = useMemo(() => {
    return engineState.pvLines.map((line) => ({
      ...line,
      san: uciToSan(gameState.fen, line.pv),
    }))
  }, [engineState.pvLines, gameState.fen])

  if (!uiState.engineEnabled) {
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t("analysis.engineOff")}
      </div>
    )
  }

  if (!analysisVisible) {
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t("analysis.guessLinesHidden")}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          {t("analysis.engineLines")}
        </p>
        {engineState.depth > 0 && (
          <p className="text-[10px] text-muted-foreground">
            d{engineState.depth}
            {engineState.nps > 0 &&
              ` · ${(engineState.nps / 1000).toFixed(0)}kn/s`}
          </p>
        )}
      </div>
      {linesWithSan.length === 0 ? (
        <div className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          {engineState.isAnalyzing
            ? t("analysis.analyzing")
            : t("analysis.noAnalysis")}
        </div>
      ) : (
        linesWithSan.map((line) => (
          <div
            key={line.id}
            className="flex items-baseline gap-2 rounded-md bg-muted/50 px-3 py-1.5 font-mono text-xs"
          >
            <span
              className={`shrink-0 font-bold ${scoreColorClass(line.score)}`}
            >
              {formatScore(line.score)}
            </span>
            <span className="truncate text-foreground/80">
              {line.san.join(" ") || "…"}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
