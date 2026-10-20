import type { BoardPoint } from "@/lib/chess/board-coordinates"

// Sizes in board squares (the overlay's viewBox is 8×8).
export type ArrowShape = {
  shaftWidth: number
  headWidth: number
  headLength: number
  // Gap between the source square's centre and the arrow's tail, so the
  // arrow leaves the piece rather than starting on top of it.
  tailOffset: number
}

type Vector = { x: number; y: number }

const sub = (a: BoardPoint, b: BoardPoint): Vector => ({
  x: a.x - b.x,
  y: a.y - b.y,
})
const add = (a: BoardPoint, v: Vector, k = 1): BoardPoint => ({
  x: a.x + v.x * k,
  y: a.y + v.y * k,
})
const unit = (v: Vector): Vector => {
  const length = Math.hypot(v.x, v.y) || 1
  return { x: v.x / length, y: v.y / length }
}
// Left-hand normal of a direction (y grows downwards in SVG).
const normal = (v: Vector): Vector => ({ x: v.y, y: -v.x })

const fmt = (n: number) => Number(n.toFixed(4))
const toPath = (points: BoardPoint[]) =>
  `M ${points.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(" L ")} Z`

/**
 * The route an arrow follows: straight, or for a knight's jump an "L" that
 * runs along the longer leg first, so it reads as a knight move.
 */
export function getArrowRoute(from: BoardPoint, to: BoardPoint): BoardPoint[] {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const isKnightJump =
    (Math.round(dx) === 1 && Math.round(dy) === 2) ||
    (Math.round(dx) === 2 && Math.round(dy) === 1)
  if (!isKnightJump) return [from, to]

  const corner = dy > dx ? { x: from.x, y: to.y } : { x: to.x, y: from.y }
  return [from, corner, to]
}

/**
 * One closed outline for shaft and head, so a translucent arrow has an even
 * colour (a line with a marker head doubles the opacity where they meet).
 * The tip lands on the target square's centre.
 */
export function buildArrowPath(
  from: BoardPoint,
  to: BoardPoint,
  shape: ArrowShape
): string {
  const route = getArrowRoute(from, to)
  const halfShaft = shape.shaftWidth / 2
  const halfHead = shape.headWidth / 2

  const firstDir = unit(sub(route[1]!, route[0]!))
  const lastDir = unit(sub(route.at(-1)!, route.at(-2)!))
  const tail = add(route[0]!, firstDir, shape.tailOffset)
  const tip = route.at(-1)!
  const headBase = add(tip, lastDir, -shape.headLength)

  const firstNormal = normal(firstDir)
  const lastNormal = normal(lastDir)

  // Left side from tail to head, then the head, then the right side back.
  const left: BoardPoint[] = [add(tail, firstNormal, halfShaft)]
  const right: BoardPoint[] = [add(tail, firstNormal, -halfShaft)]
  if (route.length === 3) {
    // Mitre the right-angle corner: offset lines meet at corner ± both
    // normals.
    const corner = route[1]!
    left.push(add(add(corner, firstNormal, halfShaft), lastNormal, halfShaft))
    right.push(
      add(add(corner, firstNormal, -halfShaft), lastNormal, -halfShaft)
    )
  }
  left.push(add(headBase, lastNormal, halfShaft))
  right.push(add(headBase, lastNormal, -halfShaft))

  return toPath([
    ...left,
    add(headBase, lastNormal, halfHead),
    tip,
    add(headBase, lastNormal, -halfHead),
    ...right.reverse(),
  ])
}
