import { Chess } from "chess.js"

type ValidationSuccess = { ok: true }
type ValidationError = { ok: false; error: string }

export type ValidationResult = ValidationSuccess | ValidationError

export type ParsedMove = {
  san: string
  fen: string
  // Mover's remaining clock time in seconds, from a `[%clk h:mm:ss]` comment.
  clock: number | null
}

export type GameMeta = {
  white: string | null
  black: string | null
  whiteElo: string | null
  blackElo: string | null
  result: string | null
}

export const EMPTY_GAME_META: GameMeta = {
  white: null,
  black: null,
  whiteElo: null,
  blackElo: null,
  result: null,
}

export type ParsedGame = {
  initialFen: string
  finalFen: string
  pgn: string
  moves: ParsedMove[]
  meta: GameMeta
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
    return { ok: false, error: "errors.fenEmpty" }
  }

  try {
    const chess = new Chess()
    chess.load(normalizedFen)
    return { ok: true }
  } catch {
    return { ok: false, error: "errors.fenInvalid" }
  }
}

export function validatePgn(pgn: string): ValidationResult {
  const normalizedPgn = normalizeInput(pgn)
  if (!normalizedPgn) {
    return { ok: false, error: "errors.pgnEmpty" }
  }

  try {
    const chess = new Chess()
    chess.loadPgn(normalizedPgn)
    const hasMoves = chess.history().length > 0
    if (!hasMoves) {
      return { ok: false, error: "errors.pgnNoMoves" }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "errors.pgnInvalid" }
  }
}

const CLOCK_RE = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/

export function parseClockComment(comment: string | undefined): number | null {
  if (!comment) return null
  const match = CLOCK_RE.exec(comment)
  if (!match) return null

  const [, hours, minutes, seconds] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

// PGN uses "?" (and "????" variants) for unknown tag values.
function headerValue(headers: Record<string, string>, key: string) {
  const value = headers[key]?.trim()
  if (!value || /^[?-]+$/.test(value)) return null
  return value
}

function readGameMeta(headers: Record<string, string>): GameMeta {
  const result = headerValue(headers, "Result")

  return {
    white: headerValue(headers, "White"),
    black: headerValue(headers, "Black"),
    whiteElo: headerValue(headers, "WhiteElo"),
    blackElo: headerValue(headers, "BlackElo"),
    result: result === "*" ? null : result,
  }
}

export function parsePgn(pgn: string): ParsePgnResult {
  const validation = validatePgn(pgn)
  if (!validation.ok) {
    return validation
  }

  try {
    const chess = new Chess()
    chess.loadPgn(normalizeInput(pgn))

    const history = chess.history({ verbose: true })
    const commentsByFen = new Map(
      chess.getComments().map(({ fen, comment }) => [fen, comment])
    )

    return {
      ok: true,
      data: {
        // Games may start from a custom position ([SetUp "1"] / [FEN]).
        initialFen: history[0]!.before,
        finalFen: chess.fen(),
        pgn: chess.pgn(),
        moves: history.map((move) => ({
          san: move.san,
          fen: move.after,
          clock: parseClockComment(commentsByFen.get(move.after)),
        })),
        meta: readGameMeta(chess.getHeaders()),
      },
    }
  } catch {
    return { ok: false, error: "errors.pgnParseFailed" }
  }
}
