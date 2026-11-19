"use client"

import { useCallback, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react"

import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { ERROR_CLASSES, findKeyMove } from "@/lib/chess/key-moments"
import { getMoveNumbering } from "@/lib/chess/move-numbering"

// One gate for every mounted control, so the desktop and mobile listeners
// share a single step. The first key applies at once. Further keys only
// remember the latest index, and one timer publishes it at most every 100 ms
// and once more when the repeat ends.
const KEY_INTERVAL_MS = 100

type StepTarget = {
  index: number
  variation: boolean
}

type AppliedStep = StepTarget & {
  from: number
  fromVariation: boolean
}

type NavApi = {
  inVariation: boolean
  currentMoveIndex: number
  variationIndex: number | null
  stepForward: () => void
  stepBack: () => void
  goToMove: (index: number) => void
  goToVariationMove: (index: number) => void
  goFirst: () => void
  goLast: () => void
  goToError: (direction: 1 | -1) => void
}

let navApi: NavApi | null = null
let mounts = 0
let pending: StepTarget | null = null
let applied: AppliedStep | null = null
let timer = 0
let lastFlush = Number.NEGATIVE_INFINITY
let lastDirection: 1 | -1 | 0 = 0
const handledKeys = new WeakSet<Event>()

function liveTarget(api: NavApi): StepTarget {
  if (api.inVariation) {
    return { index: api.variationIndex ?? 0, variation: true }
  }
  return { index: api.currentMoveIndex, variation: false }
}

function baseTarget(api: NavApi): StepTarget {
  if (pending) return pending
  const live = liveTarget(api)
  if (
    applied &&
    live.index === applied.from &&
    live.variation === applied.fromVariation
  ) {
    return { index: applied.index, variation: applied.variation }
  }
  return live
}

function resetKeyGate() {
  if (timer !== 0) window.clearTimeout(timer)
  timer = 0
  pending = null
  applied = null
  lastFlush = Number.NEGATIVE_INFINITY
  lastDirection = 0
  navApi = null
}

function cancelRepeat() {
  if (timer !== 0) window.clearTimeout(timer)
  timer = 0
  pending = null
  applied = null
  lastFlush = Number.NEGATIVE_INFINITY
  lastDirection = 0
}

function flushPending() {
  timer = 0
  const api = navApi
  const target = pending
  pending = null
  lastFlush = performance.now()
  if (!api || !target) return
  const from = liveTarget(api)
  if (target.variation) api.goToVariationMove(target.index)
  else api.goToMove(target.index)
  applied = {
    index: target.index,
    variation: target.variation,
    from: from.index,
    fromVariation: from.variation,
  }
}

function queueStep(target: StepTarget) {
  pending = target
  if (timer !== 0) return
  const wait = Math.max(0, KEY_INTERVAL_MS - (performance.now() - lastFlush))
  timer = window.setTimeout(flushPending, wait)
}

function stepFromKeyboard(direction: 1 | -1) {
  const api = navApi
  if (!api) return
  if (direction !== lastDirection) {
    if (pending) flushPending()
    lastFlush = Number.NEGATIVE_INFINITY
    lastDirection = direction
  }
  const now = performance.now()
  const base = baseTarget(api)
  const next: StepTarget = {
    index: base.index + direction,
    variation: base.variation,
  }
  const leading =
    pending === null && timer === 0 && now - lastFlush >= KEY_INTERVAL_MS

  if (leading) {
    lastFlush = now
    const from = liveTarget(api)
    if (direction === 1) api.stepForward()
    else api.stepBack()
    applied = {
      index: next.index,
      variation: next.variation,
      from: from.index,
      fromVariation: from.variation,
    }
    return
  }

  queueStep(next)
}

export function NavigationControls() {
  const { t } = useI18n()
  const {
    state,
    goToMove,
    goToVariationMove,
    stepForward,
    stepBack,
    goToEnd,
  } = useGame()

  // Inside a variation the arrows walk the variation; its first move steps
  // back to the main line.
  const inVariation = state.variation !== null && state.variationIndex !== null
  const atStart = !inVariation && state.currentMoveIndex === 0
  const atEnd = inVariation
    ? state.variationIndex === state.variation!.moves.length
    : state.currentMoveIndex === state.history.length

  // Game analysis runs in its own workers, so browsing does not cancel it.
  const goFirst = useCallback(() => goToMove(0), [goToMove])
  const goPrev = stepBack
  const goNext = stepForward
  const goLast = goToEnd

  // Shift + arrows: previous / next inaccuracy, mistake or blunder.
  const goToError = useCallback(
    (direction: 1 | -1) => {
      const ply = findKeyMove(
        state.history,
        getMoveNumbering(state.initialFen),
        inVariation ? state.variation!.branchIndex : state.currentMoveIndex,
        direction,
        { classes: ERROR_CLASSES }
      )
      if (ply !== null) goToMove(ply)
    },
    [state, inVariation, goToMove]
  )

  useEffect(() => {
    navApi = {
      inVariation,
      currentMoveIndex: state.currentMoveIndex,
      variationIndex: state.variationIndex,
      stepForward,
      stepBack,
      goToMove,
      goToVariationMove,
      goFirst,
      goLast,
      goToError,
    }
  })

  useEffect(() => {
    mounts += 1

    function handleKeyDown(e: KeyboardEvent) {
      if (handledKeys.has(e)) return
      const api = navApi
      if (!api) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      switch (e.key) {
        case "ArrowLeft":
          handledKeys.add(e)
          if (e.shiftKey) {
            cancelRepeat()
            api.goToError(-1)
          } else stepFromKeyboard(-1)
          break
        case "ArrowRight":
          handledKeys.add(e)
          if (e.shiftKey) {
            cancelRepeat()
            api.goToError(1)
          } else stepFromKeyboard(1)
          break
        case "Home":
          handledKeys.add(e)
          e.preventDefault()
          cancelRepeat()
          api.goFirst()
          break
        case "End":
          handledKeys.add(e)
          e.preventDefault()
          cancelRepeat()
          api.goLast()
          break
        default:
          return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      mounts -= 1
      if (mounts === 0) resetKeyGate()
    }
  }, [])

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atStart}
        onClick={goFirst}
        aria-label={t("navigation.first")}
        title={t("navigation.first")}
      >
        <ChevronsLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atStart}
        onClick={goPrev}
        aria-label={t("navigation.previous")}
        title={t("navigation.previous")}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atEnd}
        onClick={goNext}
        aria-label={t("navigation.next")}
        title={t("navigation.next")}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atEnd}
        onClick={goLast}
        aria-label={t("navigation.last")}
        title={t("navigation.last")}
      >
        <ChevronsRight className="size-4" />
      </Button>
    </div>
  )
}
