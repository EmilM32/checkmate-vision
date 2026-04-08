import { Chess, type PieceSymbol } from "chess.js"

export type HeatmapCell = {
  square: string
  intensity: number
  side: "white" | "black" | "neutral"
  whiteControl: number
  blackControl: number
  balance: number
}

const FILES = "abcdefgh"
const RAY_DIRECTIONS = {
  bishop: [
    { row: -1, col: -1 },
    { row: -1, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 1 },
  ],
  rook: [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ],
} as const

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

function toSquare(row: number, col: number): string {
  const rank = 8 - row
  return `${FILES[col]}${rank}`
}

function pushIfInBounds(target: string[], row: number, col: number): void {
  if (!inBounds(row, col)) return
  target.push(toSquare(row, col))
}

function collectRayAttacks(
  board: ReturnType<Chess["board"]>,
  row: number,
  col: number,
  directions: ReadonlyArray<{ row: number; col: number }>
): string[] {
  const attacks: string[] = []

  for (const direction of directions) {
    let currentRow = row + direction.row
    let currentCol = col + direction.col

    while (inBounds(currentRow, currentCol)) {
      attacks.push(toSquare(currentRow, currentCol))

      if (board[currentRow]?.[currentCol]) {
        break
      }

      currentRow += direction.row
      currentCol += direction.col
    }
  }

  return attacks
}

function collectPieceAttacks(
  board: ReturnType<Chess["board"]>,
  pieceType: PieceSymbol,
  row: number,
  col: number,
  color: "w" | "b"
): string[] {
  switch (pieceType) {
    case "p": {
      const attacks: string[] = []
      const direction = color === "w" ? -1 : 1
      pushIfInBounds(attacks, row + direction, col - 1)
      pushIfInBounds(attacks, row + direction, col + 1)
      return attacks
    }

    case "n": {
      const attacks: string[] = []
      const knightOffsets = [
        { row: -2, col: -1 },
        { row: -2, col: 1 },
        { row: -1, col: -2 },
        { row: -1, col: 2 },
        { row: 1, col: -2 },
        { row: 1, col: 2 },
        { row: 2, col: -1 },
        { row: 2, col: 1 },
      ]

      for (const offset of knightOffsets) {
        pushIfInBounds(attacks, row + offset.row, col + offset.col)
      }

      return attacks
    }

    case "b":
      return collectRayAttacks(board, row, col, RAY_DIRECTIONS.bishop)

    case "r":
      return collectRayAttacks(board, row, col, RAY_DIRECTIONS.rook)

    case "q":
      return collectRayAttacks(board, row, col, [
        ...RAY_DIRECTIONS.bishop,
        ...RAY_DIRECTIONS.rook,
      ])

    case "k": {
      const attacks: string[] = []
      for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
          if (rowDelta === 0 && colDelta === 0) continue
          pushIfInBounds(attacks, row + rowDelta, col + colDelta)
        }
      }
      return attacks
    }
  }
}

function neutralBoard(): HeatmapCell[] {
  const cells: HeatmapCell[] = []

  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of FILES) {
      cells.push({
        square: `${file}${rank}`,
        intensity: 0,
        side: "neutral",
        whiteControl: 0,
        blackControl: 0,
        balance: 0,
      })
    }
  }

  return cells
}

export function buildHeatmap(fen: string): HeatmapCell[] {
  const chess = new Chess()

  try {
    chess.load(fen)
  } catch {
    return neutralBoard()
  }

  const board = chess.board()
  const whiteAttackCount = new Map<string, number>()
  const blackAttackCount = new Map<string, number>()

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row]?.[col]
      if (!piece) continue

      const targets = collectPieceAttacks(
        board,
        piece.type,
        row,
        col,
        piece.color
      )
      const map = piece.color === "w" ? whiteAttackCount : blackAttackCount

      for (const target of targets) {
        map.set(target, (map.get(target) ?? 0) + 1)
      }
    }
  }

  const cells: HeatmapCell[] = []

  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of FILES) {
      const square = `${file}${rank}`
      const white = whiteAttackCount.get(square) ?? 0
      const black = blackAttackCount.get(square) ?? 0
      const balance = white - black
      const intensity = Math.min(Math.abs(balance) / 4, 1)

      cells.push({
        square,
        intensity,
        side: balance > 0 ? "white" : balance < 0 ? "black" : "neutral",
        whiteControl: white,
        blackControl: black,
        balance,
      })
    }
  }

  return cells
}
