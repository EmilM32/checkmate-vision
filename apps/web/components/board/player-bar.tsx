"use client"

import { useMemo } from "react"

import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import {
  formatClock,
  getClockAt,
  getMaterialSummary,
} from "@/lib/chess/player-info"

const PIECE_GLYPHS = {
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
} as const

export function PlayerBar({ color }: { color: "white" | "black" }) {
  const { t } = useI18n()
  const { state } = useGame()

  const material = useMemo(() => getMaterialSummary(state.fen), [state.fen])
  const clock = getClockAt(
    state.history,
    state.currentMoveIndex,
    state.initialFen,
    color
  )

  const name =
    state.meta[color] ??
    (color === "white" ? t("common.white") : t("common.black"))
  const elo = color === "white" ? state.meta.whiteElo : state.meta.blackElo
  const { captured, advantage } = material[color]
  const isToMove = (state.turn === "w") === (color === "white")

  return (
    <div className="flex w-full items-center justify-between gap-2 px-1 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <div
          aria-hidden="true"
          className={`size-5 shrink-0 rounded-full border border-border ${
            color === "white" ? "bg-zinc-100" : "bg-zinc-900"
          }`}
        />
        <span className="truncate text-sm font-medium text-foreground">
          {name}
        </span>
        {elo ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            ({elo})
          </span>
        ) : null}
        {captured.length > 0 || advantage > 0 ? (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="truncate text-base leading-none tracking-[-0.12em]"
            >
              {captured.map((piece) => PIECE_GLYPHS[piece]).join("")}
            </span>
            {advantage > 0 ? <span>+{advantage}</span> : null}
          </span>
        ) : null}
      </div>
      {clock !== null ? (
        <span
          className={`rounded px-1.5 font-mono text-sm tabular-nums ${
            isToMove ? "bg-foreground text-background" : "text-muted-foreground"
          }`}
        >
          {formatClock(clock)}
        </span>
      ) : null}
    </div>
  )
}
