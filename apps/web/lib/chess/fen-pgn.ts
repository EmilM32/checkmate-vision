import { Chess } from "chess.js"

type ValidationSuccess = { ok: true }
type ValidationError = { ok: false; error: string }

export type ValidationResult = ValidationSuccess | ValidationError

export type ParsedMove = {
  san: string
  fen: string
}

export type ParsedGame = {
  initialFen: string
  finalFen: string
  pgn: string
  moves: ParsedMove[]
}

type ParseResultSuccess = { ok: true; data: ParsedGame }
type ParseResultError = { ok: false; error: string }

export type ParsePgnResult = ParseResultSuccess | ParseResultError

function normalizeInput(input: string): string {
  return input.trim()
}

export function validateFen(fen: string): ValidationResult {
  const normalizedFen = normalizeInput(fen)
  if (!normalizedFen) {
    return { ok: false, error: "FEN nie moze byc pusty." }
  }

  try {
    const chess = new Chess()
    chess.load(normalizedFen)
    return { ok: true }
  } catch {
    return { ok: false, error: "Nieprawidlowy format FEN." }
  }
}

export function validatePgn(pgn: string): ValidationResult {
  const normalizedPgn = normalizeInput(pgn)
  if (!normalizedPgn) {
    return { ok: false, error: "PGN nie moze byc pusty." }
  }

  try {
    const chess = new Chess()
    chess.loadPgn(normalizedPgn)
    const hasMoves = chess.history().length > 0
    if (!hasMoves) {
      return { ok: false, error: "PGN nie zawiera ruchow." }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "Nieprawidlowy format PGN." }
  }
}

export function parsePgn(pgn: string): ParsePgnResult {
  const validation = validatePgn(pgn)
  if (!validation.ok) {
    return validation
  }

  try {
    const normalizedPgn = normalizeInput(pgn)
    const chess = new Chess()
    chess.loadPgn(normalizedPgn)

    const replay = new Chess()
    const parsedMoves: ParsedMove[] = []
    const sanMoves = chess.history()
    for (const san of sanMoves) {
      replay.move(san)
      parsedMoves.push({ san, fen: replay.fen() })
    }

    return {
      ok: true,
      data: {
        initialFen: new Chess().fen(),
        finalFen: chess.fen(),
        pgn: chess.pgn(),
        moves: parsedMoves,
      },
    }
  } catch {
    return { ok: false, error: "Nie udalo sie sparsowac PGN." }
  }
}
