"use client"

import { useMemo } from "react"
import { GitBranch } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABEL_KEYS,
  CLASSIFICATION_SYMBOLS,
} from "@/lib/chess/classification"
import { formatPlyLabel, getMoveNumbering } from "@/lib/chess/move-numbering"
import { getMoveReview } from "@/lib/chess/move-review"
import { formatSignedEval } from "@/lib/engine/eval"

/**
 * Game review of the move on the board: its class, the evaluation before
 * and after, the win chance it cost and the engine's choice, which can be
 * played out as a variation.
 */
export function MoveCard() {
  const { t } = useI18n()
  const { state, startVariation } = useGame()
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed

  const onMainLine = state.variationIndex === null
  const review = useMemo(
    () =>
      onMainLine
        ? getMoveReview(state.history, state.currentMoveIndex, state.initialFen)
        : null,
    [onMainLine, state.history, state.currentMoveIndex, state.initialFen]
  )

  if (!review || !analysisVisible) return null

  const color = CLASSIFICATION_COLORS[review.classification]
  const label = `${formatPlyLabel(
    review.ply,
    getMoveNumbering(state.initialFen)
  )} ${review.san}`

  return (
    <section
      className="rounded-lg border border-border/50 px-3 py-2 text-xs"
      aria-label={t("moveCard.title")}
      data-testid="move-card"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono font-semibold">
          {label}
          <span className="ml-0.5" style={{ color }}>
            {CLASSIFICATION_SYMBOLS[review.classification]}
          </span>
        </span>
        <span className="font-medium" style={{ color }}>
          {t(CLASSIFICATION_LABEL_KEYS[review.classification])}
        </span>
      </div>

      <p className="mt-1 text-muted-foreground">
        {t("moveCard.eval", {
          before: formatSignedEval(review.scoreBefore),
          after: formatSignedEval(review.scoreAfter),
        })}
        {review.winChanceLoss >= 1
          ? ` · ${t("moveCard.winChanceLoss", {
              points: Math.round(review.winChanceLoss),
            })}`
          : null}
      </p>

      {review.best ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span>
            {t("moveCard.best")}{" "}
            <span className="font-mono font-semibold">{review.best.san}</span>{" "}
            <span className="text-muted-foreground">
              ({formatSignedEval(review.best.score)})
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => startVariation(review.ply - 1, review.best!.uci)}
          >
            <GitBranch className="size-3" />
            {t("moveCard.playBest")}
          </Button>
        </div>
      ) : (
        <p className="mt-1.5 text-muted-foreground">{t("moveCard.wasBest")}</p>
      )}
    </section>
  )
}
