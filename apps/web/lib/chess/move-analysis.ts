import { Chess, type Move } from "chess.js"

import type { EngineLine, EngineScore } from "@/context/engine-context"
import type { MoveAnalysisPatch } from "@/context/game-context"
import { classifyMove, computeMoveDelta } from "@/lib/chess/classification"
import { getSideToMove } from "@/lib/engine/eval"

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
} as const

function countLegalMoves(fen: string): number {
  try {
    return new Chess(fen).moves().length
  } catch {
    return 0
  }
}

function samePosition(a: string, b: string) {
  return (
    a.split(" ").slice(0, 4).join(" ") === b.split(" ").slice(0, 4).join(" ")
  )
}

function findPlayedMove(fenBefore: string, fenAfter: string): Move | null {
  try {
    return (
      new Chess(fenBefore)
        .moves({ verbose: true })
        .find((move) => samePosition(move.after, fenAfter)) ?? null
    )
  } catch {
    return null
  }
}

/**
 * Material (in pawns) the opponent can win right after the move, net of
 * what the move itself captured: the best single capture, counting a
 * defended piece as traded for its attacker.
 */
export function getSacrificedMaterial(move: Move): number {
  const position = new Chess(move.after)
  let offered = 0
  for (const reply of position.moves({ verbose: true })) {
    if (!reply.captured) continue
    const value = PIECE_VALUES[reply.captured]
    const gain = position.isAttacked(reply.to, move.color)
      ? value - PIECE_VALUES[reply.piece]
      : value
    offered = Math.max(offered, gain)
  }
  return offered - (move.captured ? PIECE_VALUES[move.captured] : 0)
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

export type MoveEvaluation = {
  fenBefore: string
  fenAfter: string
  // Engine lines of the position before the move, best first.
  linesBefore: EngineLine[]
  // Best-line score of the position after the move.
  scoreAfter: EngineScore
}

export function buildMoveAnalysis({
  fenBefore,
  fenAfter,
  linesBefore,
  scoreAfter,
}: MoveEvaluation): MoveAnalysisPatch {
  const playedBy = getSideToMove(fenBefore) === "w" ? "white" : "black"
  const scoreBefore = linesBefore[0]?.score ?? null
  const move = findPlayedMove(fenBefore, fenAfter)
  const isEngineChoice = !!move && linesBefore[0]?.pv[0] === move.lan

  return {
    scoreBefore,
    scoreAfter,
    bestMove: linesBefore[0]?.pv[0] ?? null,
    bestScore: scoreBefore,
    delta: computeMoveDelta(scoreBefore, scoreAfter, playedBy),
    classification:
      scoreBefore && scoreAfter
        ? classifyMove({
            scoreBefore,
            scoreAfter,
            playedBy,
            isOnlyLegalMove: countLegalMoves(fenBefore) === 1,
            secondBestScore: isEngineChoice
              ? (linesBefore[1]?.score ?? null)
              : null,
            sacrificedMaterial: move ? getSacrificedMaterial(move) : 0,
          })
        : null,
  }
}
