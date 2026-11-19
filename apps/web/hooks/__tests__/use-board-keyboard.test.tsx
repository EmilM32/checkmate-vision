import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useBoardKeyboard } from "@/hooks/use-board-keyboard"

const goToMove = vi.fn()
const goToVariationMove = vi.fn()
const stepForward = vi.fn()
const stepBack = vi.fn()
const goToEnd = vi.fn()

const gameState = {
  currentMoveIndex: 0,
  initialFen: "start",
  history: [] as { san: string; fen: string }[],
  variation: null as { branchIndex: number; moves: { san: string }[] } | null,
  variationIndex: null as number | null,
}

vi.mock("@/hooks/use-game", () => ({
  useGame: () => ({
    state: gameState,
    goToMove,
    goToVariationMove,
    stepForward,
    stepBack,
    goToEnd,
  }),
}))

function Probe() {
  useBoardKeyboard()
  return null
}

describe("useBoardKeyboard", () => {
  afterEach(() => {
    cleanup()
    gameState.currentMoveIndex = 0
    gameState.history = []
    gameState.variation = null
    gameState.variationIndex = null
    for (const fn of [goToMove, goToVariationMove, stepForward, stepBack, goToEnd]) {
      fn.mockReset()
    }
  })

  it("answers a single arrow, Home, and End immediately", () => {
    gameState.currentMoveIndex = 1
    gameState.history = [
      { san: "e4", fen: "fen1" },
      { san: "e5", fen: "fen2" },
    ]
    render(<Probe />)

    fireEvent.keyDown(document, { key: "ArrowLeft" })
    fireEvent.keyDown(document, { key: "Home" })
    fireEvent.keyDown(document, { key: "End" })

    expect(stepBack).toHaveBeenCalledTimes(1)
    expect(goToMove).toHaveBeenCalledWith(0)
    expect(goToEnd).toHaveBeenCalledTimes(1)
  })

  it("steps once immediately and lands on the last index of a repeat", () => {
    vi.useFakeTimers()
    try {
      gameState.history = Array.from({ length: 20 }, (_, index) => ({
        san: "e4",
        fen: `fen-${index}`,
      }))
      render(<Probe />)

      fireEvent.keyDown(document, { key: "ArrowRight" })
      expect(stepForward).toHaveBeenCalledTimes(1)
      expect(goToMove).not.toHaveBeenCalled()

      for (let step = 0; step < 5; step++) {
        fireEvent.keyDown(document, { key: "ArrowRight" })
      }
      expect(stepForward).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      expect(goToMove).toHaveBeenCalledTimes(1)
      expect(goToMove).toHaveBeenCalledWith(6)
    } finally {
      vi.useRealTimers()
    }
  })

  it("drops a pending step when the hook unmounts", () => {
    vi.useFakeTimers()
    try {
      gameState.history = Array.from({ length: 10 }, (_, index) => ({
        san: "e4",
        fen: `fen-${index}`,
      }))
      const view = render(<Probe />)
      fireEvent.keyDown(document, { key: "ArrowRight" })
      fireEvent.keyDown(document, { key: "ArrowRight" })
      view.unmount()
      vi.advanceTimersByTime(100)
      expect(goToMove).not.toHaveBeenCalled()

      goToMove.mockReset()
      stepForward.mockReset()
      render(<Probe />)
      fireEvent.keyDown(document, { key: "ArrowRight" })
      expect(stepForward).toHaveBeenCalledTimes(1)
      expect(goToMove).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("ignores arrows while typing in a form field", () => {
    render(
      <div>
        <input aria-label="fen" />
        <Probe />
      </div>
    )

    fireEvent.keyDown(screen.getByRole("textbox", { name: "fen" }), {
      key: "ArrowRight",
    })
    expect(stepForward).not.toHaveBeenCalled()
  })
})
