import type { EngineScore } from "@/context/engine-context"

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "good"
  | "mistake"
  | "blunder"

export const CLASSIFICATION_LABEL_KEYS: Record<MoveClassification, string> = {
  brilliant: "classification.brilliant",
  great: "classification.great",
  best: "classification.best",
  good: "classification.good",
  mistake: "classification.mistake",
  blunder: "classification.blunder",
}

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  brilliant: "#26c6da",
  great: "#66bb6a",
  best: "#a5d6a7",
  good: "#e0e0e0",
  mistake: "#ffa726",
  blunder: "#ef5350",
}

export type ClassificationInput = {
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  playedBy: "white" | "black"
  plyIndex?: number
  pvGapCp?: number | null
  isOnlyLegalMove?: boolean
  isMaterialSacrifice?: boolean
  isNearBest?: boolean
  isOnlyWinningMoveInLosingPosition?: boolean
}

const BRILLIANT_NEAR_BEST_CP = 30
const OPENING_LENIENCY_PLY_LIMIT = 8
const OPENING_LENIENCY_SCORE_CAP_CP = 120

const DEFAULT_THRESHOLDS = {
  best: 10,
  good: 50,
  mistake: 200,
} as const

const OPENING_THRESHOLDS = {
  best: 15,
  good: 100,
  mistake: 250,
} as const

function normalizeCpDelta(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  playedBy: "white" | "black"
): number | null {
  if (!scoreBefore || !scoreAfter) return null
  if (scoreBefore.type !== "cp" || scoreAfter.type !== "cp") return null

  const direction = playedBy === "white" ? 1 : -1
  return (scoreBefore.value - scoreAfter.value) * direction
}

function normalizeMateDelta(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  playedBy: "white" | "black"
): number | null {
  if (!scoreBefore || !scoreAfter) return null
  if (scoreBefore.type !== "mate" || scoreAfter.type !== "mate") return null

  const direction = playedBy === "white" ? 1 : -1
  return (scoreBefore.value - scoreAfter.value) * direction
}

function toLossInCp(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  playedBy: "white" | "black"
): number {
  const cpDelta = normalizeCpDelta(scoreBefore, scoreAfter, playedBy)
  if (cpDelta !== null) return cpDelta

  const mateDelta = normalizeMateDelta(scoreBefore, scoreAfter, playedBy)
  if (mateDelta !== null) {
    // In mate mode, larger positive delta means bigger worsening.
    return mateDelta * 100
  }

  // Crossing cp <-> mate is treated as a large swing.
  const beforeCp = scoreBefore?.type === "cp" ? scoreBefore.value : 0
  const afterCp = scoreAfter?.type === "cp" ? scoreAfter.value : 0
  const direction = playedBy === "white" ? 1 : -1
  return (beforeCp - afterCp) * direction
}

function getThresholds(
  scoreBefore: EngineScore,
  scoreAfter: EngineScore,
  plyIndex?: number
) {
  if (
    typeof plyIndex !== "number" ||
    plyIndex < 1 ||
    plyIndex > OPENING_LENIENCY_PLY_LIMIT
  ) {
    return DEFAULT_THRESHOLDS
  }

  if (scoreBefore?.type !== "cp" || scoreAfter?.type !== "cp") {
    return DEFAULT_THRESHOLDS
  }

  const maxAbsScore = Math.max(
    Math.abs(scoreBefore.value),
    Math.abs(scoreAfter.value)
  )

  if (maxAbsScore > OPENING_LENIENCY_SCORE_CAP_CP) {
    return DEFAULT_THRESHOLDS
  }

  return OPENING_THRESHOLDS
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
    plyIndex,
    pvGapCp,
    isOnlyLegalMove,
    isMaterialSacrifice,
    isNearBest,
    isOnlyWinningMoveInLosingPosition,
  } = input

  if (isOnlyLegalMove) {
    return "best"
  }

  const deltaLoss = toLossInCp(scoreBefore, scoreAfter, playedBy)
  const thresholds = getThresholds(scoreBefore, scoreAfter, plyIndex)

  const nearBest = isNearBest ?? Math.abs(deltaLoss) <= BRILLIANT_NEAR_BEST_CP

  if ((isMaterialSacrifice && nearBest) || isOnlyWinningMoveInLosingPosition) {
    return "brilliant"
  }

  if (deltaLoss <= 0 && (pvGapCp ?? 0) >= 50) {
    return "great"
  }

  if (deltaLoss <= thresholds.best) {
    return "best"
  }

  if (deltaLoss <= thresholds.good) {
    return "good"
  }

  if (deltaLoss <= thresholds.mistake) {
    return "mistake"
  }

  return "blunder"
}
