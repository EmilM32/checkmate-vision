type MultiPvLineId = 1 | 2 | 3

type ParsedSquare = {
  fileIndex: number
  rankIndex: number
}

type BoardPoint = {
  x: number
  y: number
}

export type ArrowGeometry = {
  id: MultiPvLineId
  from: string
  to: string
  uci: string
}

export type MultiPvLineInput = {
  id: MultiPvLineId
  pv: string[]
}

const FILES = "abcdefgh"
const SQUARE_RE = /^[a-h][1-8]$/

function parseSquare(square: string): ParsedSquare | null {
  if (!SQUARE_RE.test(square)) return null

  const fileIndex = FILES.indexOf(square[0]!)
  const rankIndex = Number.parseInt(square[1]!, 10) - 1

  if (fileIndex < 0 || rankIndex < 0 || rankIndex > 7) return null

  return { fileIndex, rankIndex }
}

export function squareCenterUnits(
  square: string,
  boardFlipped: boolean
): BoardPoint | null {
  const parsed = parseSquare(square)
  if (!parsed) return null

  if (boardFlipped) {
    return {
      x: 7 - parsed.fileIndex + 0.5,
      y: parsed.rankIndex + 0.5,
    }
  }

  return {
    x: parsed.fileIndex + 0.5,
    y: 7 - parsed.rankIndex + 0.5,
  }
}

export function squareCenterPixels(
  square: string,
  boardSizePx: number,
  boardFlipped: boolean
): BoardPoint | null {
  if (boardSizePx <= 0) return null

  const point = squareCenterUnits(square, boardFlipped)
  if (!point) return null

  const squareSize = boardSizePx / 8
  return {
    x: point.x * squareSize,
    y: point.y * squareSize,
  }
}

export function firstMoveArrowFromUci(
  uci: string | null | undefined
): { from: string; to: string; uci: string } | null {
  if (!uci || uci.length < 4) return null

  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)

  if (!SQUARE_RE.test(from) || !SQUARE_RE.test(to)) return null

  return { from, to, uci }
}

export function buildMultiPvArrows(lines: MultiPvLineInput[]): ArrowGeometry[] {
  return lines.slice(0, 3).flatMap((line) => {
    const parsed = firstMoveArrowFromUci(line.pv[0])
    if (!parsed) return []

    return [
      {
        id: line.id,
        from: parsed.from,
        to: parsed.to,
        uci: parsed.uci,
      },
    ]
  })
}
