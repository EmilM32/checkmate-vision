import type { EngineScore } from "@/context/engine-context"

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"

export const CLASSIFICATION_LABEL_KEYS: Record<MoveClassification, string> = {
  brilliant: "classification.brilliant",
  great: "classification.great",
  best: "classification.best",
  good: "classification.good",
  inaccuracy: "classification.inaccuracy",
  mistake: "classification.mistake",
  blunder: "classification.blunder",
}

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  brilliant: "#26c6da",
  great: "#66bb6a",
  best: "#a5d6a7",
  good: "#9ca3af",
  inaccuracy: "#eab308",
  mistake: "#ffa726",
  blunder: "#ef5350",
}

// Standard annotation symbols; "best" and "good" moves carry none.
export const CLASSIFICATION_SYMBOLS: Record<MoveClassification, string> = {
  brilliant: "!!",
  great: "!",
  best: "",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
}

export type ClassificationInput = {
  // Best-line scores of the positions before and after the move, from
  // White's perspective.
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  playedBy: "white" | "black"
  isOnlyLegalMove?: boolean
  // Score of the second-best move, given only when the played move was the
  // engine's first choice.
  secondBestScore?: EngineScore
  // Material (in pawns) the opponent can win at once after the move.
  sacrificedMaterial?: number
}

// Maximum loss of win chance, in percentage points, per class. Win chance
// flattens out in decided positions, so the same centipawn loss weighs less
// at +8 than at 0.
const WIN_CHANCE_LOSS = {
  best: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
} as const

// "Great": the only move; the second best would have been a mistake and
// would have changed the expected result (a win into a draw, a draw into a
// loss).
const GREAT_MOVE_GAP = 10
// "Brilliant": at least a minor piece (or the exchange) given up for no
// loss, and the mover not worse after it.
const BRILLIANT_MIN_SACRIFICE = 2
const BRILLIANT_MIN_WIN_AFTER = 50
// Win chance from which a position counts as won (about +2.3), or below
// which as lost.
const WINNING_CHANCE = 70

// Lichess' fit of win probability to centipawns, clamped where it saturates.
const WIN_CHANCE_SLOPE = 0.00368208
const DECISIVE_SCORE_CP = 1000

function direction(playedBy: "white" | "black"): 1 | -1 {
  return playedBy === "white" ? 1 : -1
}

/**
 * The mover's chance to win (0-100) in a position scored from White's
 * perspective. `mate 0` after a move means the mover delivered checkmate.
 */
export function getWinChance(
  score: Exclude<EngineScore, null>,
  playedBy: "white" | "black"
): number {
  if (score.type === "mate") {
    const sign =
      score.value === 0 ? 1 : Math.sign(score.value) * direction(playedBy)
    return sign > 0 ? 100 : 0
  }

  const cp = Math.max(
    -DECISIVE_SCORE_CP,
    Math.min(DECISIVE_SCORE_CP, score.value * direction(playedBy))
  )
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_CHANCE_SLOPE * cp)) - 1)
}

function getOutcome(winChance: number): -1 | 0 | 1 {
  if (winChance >= WINNING_CHANCE) return 1
  if (winChance <= 100 - WINNING_CHANCE) return -1
  return 0
}

function normalizeCpDelta(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  playedBy: "white" | "black"
): number | null {
  if (!scoreBefore || !scoreAfter) return null
  if (scoreBefore.type !== "cp" || scoreAfter.type !== "cp") return null

  return (scoreBefore.value - scoreAfter.value) * direction(playedBy)
}

function normalizeMateDelta(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  playedBy: "white" | "black"
): number | null {
  if (!scoreBefore || !scoreAfter) return null
  if (scoreBefore.type !== "mate" || scoreAfter.type !== "mate") return null

  return (scoreBefore.value - scoreAfter.value) * direction(playedBy)
}

export function computeMoveDelta(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  playedBy: "white" | "black"
): number | null {
  if (!scoreBefore || !scoreAfter) return null

  if (scoreBefore.type === "mate" && scoreAfter.type === "mate") {
    return normalizeMateDelta(scoreBefore, scoreAfter, playedBy)
  }

  return normalizeCpDelta(scoreBefore, scoreAfter, playedBy)
}

export function classifyMove(input: ClassificationInput): MoveClassification {
  const {
    scoreBefore,
    scoreAfter,
    playedBy,
    isOnlyLegalMove,
    secondBestScore,
    sacrificedMaterial = 0,
  } = input

  if (isOnlyLegalMove || !scoreBefore || !scoreAfter) {
    return "best"
  }

  const winBefore = getWinChance(scoreBefore, playedBy)
  const winAfter = getWinChance(scoreAfter, playedBy)
  const loss = winBefore - winAfter

  if (
    sacrificedMaterial >= BRILLIANT_MIN_SACRIFICE &&
    loss <= WIN_CHANCE_LOSS.best &&
    winAfter >= BRILLIANT_MIN_WIN_AFTER
  ) {
    return "brilliant"
  }

  if (secondBestScore && loss <= WIN_CHANCE_LOSS.best) {
    const winSecond = getWinChance(secondBestScore, playedBy)
    if (
      winAfter - winSecond >= GREAT_MOVE_GAP &&
      getOutcome(winSecond) < getOutcome(winAfter)
    ) {
      return "great"
    }
  }

  if (loss <= WIN_CHANCE_LOSS.best) return "best"
  if (loss <= WIN_CHANCE_LOSS.good) return "good"
  if (loss <= WIN_CHANCE_LOSS.inaccuracy) return "inaccuracy"
  if (loss <= WIN_CHANCE_LOSS.mistake) return "mistake"
  return "blunder"
}
