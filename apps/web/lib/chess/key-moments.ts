import type { MoveEntry } from "@/context/game-context"
import type { MoveClassification } from "@/lib/chess/classification"
import { getPlyColor, type MoveNumbering } from "@/lib/chess/move-numbering"

export const ERROR_CLASSES: MoveClassification[] = [
  "inaccuracy",
  "mistake",
  "blunder",
]

type KeyMoveFilter = {
  classes: MoveClassification[]
  side?: "white" | "black"
}

/**
 * The next (or previous) ply after `fromPly` whose move matches the filter,
 * wrapping around the game; null when no move matches.
 */
export function findKeyMove(
  history: MoveEntry[],
  numbering: MoveNumbering,
  fromPly: number,
  direction: 1 | -1,
  { classes, side }: KeyMoveFilter
): number | null {
  const count = history.length
  for (let step = 1; step <= count; step++) {
    const ply =
      ((((fromPly - 1 + direction * step) % count) + count) % count) + 1
    const move = history[ply - 1]!
    if (
      move.classification &&
      classes.includes(move.classification) &&
      (!side || getPlyColor(ply, numbering) === side)
    ) {
      return ply
    }
  }
  return null
}
