export type EngineScore =
  | { type: "cp"; value: number }
  | { type: "mate"; value: number }

export type ParsedInfoLine = {
  depth: number
  nps: number
  multipv: 1 | 2 | 3
  score: EngineScore | null
  pv: string[]
}

export type ParsedBestMove = {
  move: string
  ponder: string | null
}
