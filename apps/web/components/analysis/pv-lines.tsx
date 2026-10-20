"use client"

import { useMemo } from "react"
import { Chess } from "chess.js"
import { Button } from "@workspace/ui/components/button"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import type { EngineScore } from "@/context/engine-context"
import { getTerminalScore } from "@/lib/chess/move-analysis"
import { formatSignedEval } from "@/lib/engine/eval"
import { PV_LINE_COLORS, PV_LINE_LABEL_KEYS } from "@/lib/chess/pv-line-colors"

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
  const { state: engineState, retryEngine } = useEngine()
  const { state: gameState } = useGame()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed

  const linesWithSan = useMemo(() => {
    return engineState.pvLines.map((line) => ({
      ...line,
      san: uciToSan(gameState.fen, line.pv),
    }))
  }, [engineState.pvLines, gameState.fen])
  const terminalScore = useMemo(
    () => getTerminalScore(gameState.fen),
    [gameState.fen]
  )

  if (!uiState.engineEnabled) {
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t("analysis.engineOff")}
      </div>
    )
  }

  if (engineState.error) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        <span>{t(engineState.error)}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0"
          onClick={retryEngine}
        >
          {t("common.retry")}
        </Button>
      </div>
    )
  }

  // No engine lines exist for a finished game; say why instead.
  if (terminalScore) {
    return (
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-medium text-foreground/80">
        {terminalScore.type === "mate"
          ? t("analysis.checkmate")
          : t("analysis.stalemate")}
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
            title={t(PV_LINE_LABEL_KEYS[line.id])}
          >
            {/* Matches the colour of this line's arrow on the board. */}
            <span
              aria-label={t(PV_LINE_LABEL_KEYS[line.id])}
              role="img"
              data-testid="pv-line-color"
              className="h-3 w-1 shrink-0 self-center rounded-full"
              style={{ backgroundColor: PV_LINE_COLORS[line.id] }}
            />
            <span
              data-testid="pv-score"
              className={`shrink-0 font-bold ${scoreColorClass(line.score)}`}
            >
              {formatSignedEval(line.score)}
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
