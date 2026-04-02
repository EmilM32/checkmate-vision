export type ParsedGame = {
  fen: string
  pgn: string
  moves: string[]
}

export function validateFen(fen: string) {
  void fen
  // TODO: wire chess.js validation.
  return { ok: true as const }
}

export function validatePgn(pgn: string) {
  void pgn
  // TODO: wire chess.js validation.
  return { ok: true as const }
}

export function parsePgn(pgn: string): ParsedGame | null {
  void pgn
  // TODO: parse PGN into normalized move list.
  return null
}
