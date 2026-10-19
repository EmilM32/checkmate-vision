import type { EngineScore } from "@/context/engine-context"
import type { MoveEntry } from "@/context/game-context"
import {
  getWinChance,
  type MoveClassification,
} from "@/lib/chess/classification"
import { getPlyColor, type MoveNumbering } from "@/lib/chess/move-numbering"

type Side = "white" | "black"

export type PlayerSummary = {
  // 0-100, Lichess' game accuracy.
  accuracy: number
  counts: Record<MoveClassification, number>
}

export type GameSummary = Record<Side, PlayerSummary>

// Lichess' fit of move accuracy to the loss of win chance.
function getMoveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100
  const raw =
    103.1668100711649 *
      Math.exp(-0.04354415386753951 * (winBefore - winAfter)) -
    3.166924740191411
  // +1: the engine's own uncertainty.
  return Math.max(0, Math.min(100, raw + 1))
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function weightedMean(values: number[], weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return (
    values.reduce((sum, value, index) => sum + value * weights[index]!, 0) /
    total
  )
}

function harmonicMean(values: number[]): number {
  if (values.some((value) => value === 0)) return 0
  return values.length / values.reduce((sum, value) => sum + 1 / value, 0)
}

// White's chance to win; `mate 0` is a win for the side that just moved.
function whiteWinChance(score: Exclude<EngineScore, null>, lastMover: Side) {
  const mover = getWinChance(score, lastMover)
  return lastMover === "white" ? mover : 100 - mover
}

function emptyCounts(): Record<MoveClassification, number> {
  return {
    brilliant: 0,
    great: 0,
    best: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  }
}

/**
 * Accuracy and move classes per player, once every move of the game has
 * been analysed. Accuracy follows Lichess: per-move accuracy from the loss
 * of win chance, averaged both weighted by how sharp the position was and
 * harmonically (so a single blunder weighs in), then the two averaged.
 */
export function getGameSummary(
  history: MoveEntry[],
  numbering: MoveNumbering
): GameSummary | null {
  if (history.length === 0) return null
  if (history.some((move) => !move.scoreBefore || !move.scoreAfter)) {
    return null
  }

  const movers = history.map((_, index) => getPlyColor(index + 1, numbering))
  const opponent = (side: Side): Side => (side === "white" ? "black" : "white")

  // Win chances of every position of the game, from White's perspective.
  const wins = [
    whiteWinChance(history[0]!.scoreBefore!, opponent(movers[0]!)),
    ...history.map((move, index) =>
      whiteWinChance(move.scoreAfter!, movers[index]!)
    ),
  ]

  const windowSize = Math.max(2, Math.min(8, Math.floor(history.length / 10)))
  const windows = [
    ...Array.from({ length: Math.min(windowSize, wins.length) - 2 }, () =>
      wins.slice(0, windowSize)
    ),
    ...Array.from(
      { length: Math.max(1, wins.length - windowSize + 1) },
      (_, index) => wins.slice(index, index + windowSize)
    ),
  ]
  const weights = windows.map((window) =>
    Math.max(0.5, Math.min(12, standardDeviation(window)))
  )

  const perSide = {
    white: { accuracies: [] as number[], weights: [] as number[] },
    black: { accuracies: [] as number[], weights: [] as number[] },
  }
  const counts = { white: emptyCounts(), black: emptyCounts() }

  history.forEach((move, index) => {
    const side = movers[index]!
    const sign = side === "white" ? 1 : -1
    const before = sign === 1 ? wins[index]! : 100 - wins[index]!
    const after = sign === 1 ? wins[index + 1]! : 100 - wins[index + 1]!
    perSide[side].accuracies.push(getMoveAccuracy(before, after))
    perSide[side].weights.push(weights[index] ?? weights.at(-1)!)
    if (move.classification) counts[side][move.classification] += 1
  })

  const accuracyOf = (side: Side) => {
    const { accuracies, weights: sideWeights } = perSide[side]
    if (accuracies.length === 0) return 100
    return (
      (weightedMean(accuracies, sideWeights) + harmonicMean(accuracies)) / 2
    )
  }

  return {
    white: { accuracy: accuracyOf("white"), counts: counts.white },
    black: { accuracy: accuracyOf("black"), counts: counts.black },
  }
}
