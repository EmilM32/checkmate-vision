import { Chess } from "chess.js"

import type { EngineScore } from "@/context/engine-context"
import type { MoveAnalysisPatch } from "@/context/game-context"
import {
  classifyMove,
  computeMoveDelta,
  type ClassificationInput,
} from "@/lib/chess/classification"
import { getSideToMove } from "@/lib/engine/eval"

type Side = "white" | "black"

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
} as const

const DECISIVE_CP = 250

function countLegalMoves(fen: string): number {
  try {
    return new Chess(fen).moves().length
  } catch {
    return 0
  }
}

function getSideMaterial(fen: string, side: "w" | "b"): number {
  try {
    return new Chess(fen)
      .board()
      .flat()
      .reduce((sum, piece) => {
        if (!piece || piece.color !== side) return sum
        return sum + PIECE_VALUES[piece.type]
      }, 0)
  } catch {
    return 0
  }
}

function isMaterialSacrifice(fenBefore: string, fenAfter: string, side: Side) {
  const color = side === "white" ? "w" : "b"
  return getSideMaterial(fenAfter, color) < getSideMaterial(fenBefore, color)
}

// Scores are from White's perspective; `mate 0` after a move means the mover
// delivered checkmate.
function scoreFor(score: EngineScore, side: Side): number | null {
  if (!score) return null
  const direction = side === "white" ? 1 : -1
  if (score.type === "mate") {
    return score.value === 0
      ? Infinity
      : Math.sign(score.value) * direction * Infinity
  }
  return score.value * direction
}

function isLosingFor(score: EngineScore, side: Side) {
  const value = scoreFor(score, side)
  return value !== null && value <= -DECISIVE_CP
}

function isWinningFor(score: EngineScore, side: Side) {
  const value = scoreFor(score, side)
  return value !== null && value >= DECISIVE_CP
}

// Positions without legal moves are never sent to Stockfish: it answers them
// with a depth-0 info line and "bestmove (none)", which carry no useful lines.
export function getTerminalScore(fen: string): EngineScore {
  try {
    const chess = new Chess(fen)
    if (chess.moves().length > 0) return null
    return chess.isCheck()
      ? { type: "mate", value: 0 }
      : { type: "cp", value: 0 }
  } catch {
    return null
  }
}

// Gap between the two best lines of the position reached by the move; a
// large gap means the move was the only good one.
export function getPvGapCp(
  first: EngineScore,
  second: EngineScore
): number | null {
  if (!first || !second) return null
  if (first.type !== "cp" || second.type !== "cp") return null
  return Math.abs(first.value - second.value)
}

export type MoveEvaluation = {
  ply: number
  fenBefore: string
  fenAfter: string
  // Best-line scores of the positions before and after the move.
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  pvGapCp: number | null
}

export function buildMoveAnalysis({
  ply,
  fenBefore,
  fenAfter,
  scoreBefore,
  scoreAfter,
  pvGapCp,
}: MoveEvaluation): MoveAnalysisPatch {
  const playedBy: Side = getSideToMove(fenBefore) === "w" ? "white" : "black"

  const input: ClassificationInput = {
    scoreBefore,
    scoreAfter,
    playedBy,
    plyIndex: ply,
    pvGapCp,
    isOnlyLegalMove: countLegalMoves(fenBefore) === 1,
    isMaterialSacrifice: isMaterialSacrifice(fenBefore, fenAfter, playedBy),
    isOnlyWinningMoveInLosingPosition:
      isLosingFor(scoreBefore, playedBy) && isWinningFor(scoreAfter, playedBy),
  }

  return {
    scoreBefore,
    scoreAfter,
    delta: computeMoveDelta(scoreBefore, scoreAfter, playedBy),
    classification: scoreBefore && scoreAfter ? classifyMove(input) : null,
  }
}
