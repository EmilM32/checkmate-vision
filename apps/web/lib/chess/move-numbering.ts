// Plies are 1-based indexes into the game history. Games loaded from a FEN
// can start with Black to move and at any full-move number, so numbering and
// colors are derived from the initial position instead of assuming 1. e4.
export type MoveNumbering = {
  firstMoveNumber: number
  blackMovesFirst: boolean
}

export function getMoveNumbering(initialFen: string): MoveNumbering {
  const [, sideToMove, , , , fullMove] = initialFen.split(" ")
  const parsed = Number.parseInt(fullMove ?? "", 10)

  return {
    firstMoveNumber: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
    blackMovesFirst: sideToMove === "b",
  }
}

function plyOffset(ply: number, numbering: MoveNumbering): number {
  return ply - 1 + (numbering.blackMovesFirst ? 1 : 0)
}

export function getPlyColor(
  ply: number,
  numbering: MoveNumbering
): "white" | "black" {
  return plyOffset(ply, numbering) % 2 === 0 ? "white" : "black"
}

export function getPlyMoveNumber(
  ply: number,
  numbering: MoveNumbering
): number {
  return numbering.firstMoveNumber + Math.floor(plyOffset(ply, numbering) / 2)
}

// "12." for White's move, "12..." for Black's.
export function formatPlyLabel(ply: number, numbering: MoveNumbering): string {
  const moveNumber = getPlyMoveNumber(ply, numbering)
  return getPlyColor(ply, numbering) === "white"
    ? `${moveNumber}.`
    : `${moveNumber}...`
}
