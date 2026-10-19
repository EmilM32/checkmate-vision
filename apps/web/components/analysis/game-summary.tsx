"use client"

import { useMemo } from "react"

import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABEL_KEYS,
  CLASSIFICATION_SYMBOLS,
  type MoveClassification,
} from "@/lib/chess/classification"
import { getGameSummary } from "@/lib/chess/game-summary"
import { getMoveNumbering } from "@/lib/chess/move-numbering"

// Classes worth counting; "best" and "good" make up the rest.
const COUNTED: MoveClassification[] = [
  "brilliant",
  "great",
  "inaccuracy",
  "mistake",
  "blunder",
]

/** Accuracy and notable moves per player once the whole game is analysed. */
export function GameSummary() {
  const { t } = useI18n()
  const { state } = useGame()

  const summary = useMemo(
    () => getGameSummary(state.history, getMoveNumbering(state.initialFen)),
    [state.history, state.initialFen]
  )

  if (!summary) return null

  return (
    <div
      className="grid grid-cols-2 gap-2"
      data-testid="game-summary"
      aria-label={t("summary.title")}
    >
      {(["white", "black"] as const).map((side) => {
        const name =
          state.meta[side] ??
          (side === "white" ? t("common.white") : t("common.black"))
        const { accuracy, counts } = summary[side]

        return (
          <div
            key={side}
            className="rounded-lg border border-border/50 px-3 py-2"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`size-2.5 shrink-0 rounded-full border border-foreground/30 ${
                  side === "white" ? "bg-white" : "bg-neutral-900"
                }`}
              />
              <span className="truncate">{name}</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span
                className="font-mono text-lg font-semibold"
                data-testid={`accuracy-${side}`}
              >
                {accuracy.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("summary.accuracy")}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-xs">
              {COUNTED.filter((kind) => counts[kind] > 0).map((kind) => (
                <span
                  key={kind}
                  title={t(CLASSIFICATION_LABEL_KEYS[kind])}
                  aria-label={`${t(CLASSIFICATION_LABEL_KEYS[kind])}: ${counts[kind]}`}
                >
                  <span
                    className="font-bold"
                    style={{ color: CLASSIFICATION_COLORS[kind] }}
                  >
                    {CLASSIFICATION_SYMBOLS[kind]}
                  </span>{" "}
                  {counts[kind]}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
