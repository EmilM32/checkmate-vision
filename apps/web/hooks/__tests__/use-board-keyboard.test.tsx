import React from "react"
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

  it("steps back from the last move after a right-arrow hold", () => {
    gameState.history = Array.from({ length: 4 }, (_, index) => ({
      san: "e4",
      fen: `fen-${index}`,
    }))
    gameState.currentMoveIndex = 4
    render(<Probe />)

    for (let step = 0; step < 6; step++) {
      fireEvent.keyDown(document, { key: "ArrowRight" })
    }
    fireEvent.keyDown(document, { key: "ArrowLeft" })

    expect(stepForward).not.toHaveBeenCalled()
    expect(goToMove).not.toHaveBeenCalled()
    expect(stepBack).toHaveBeenCalledTimes(1)
  })

  it("steps forward from the start after a left-arrow hold", () => {
    gameState.history = [
      { san: "e4", fen: "fen1" },
      { san: "e5", fen: "fen2" },
    ]
    gameState.currentMoveIndex = 0
    render(<Probe />)

    for (let step = 0; step < 6; step++) {
      fireEvent.keyDown(document, { key: "ArrowLeft" })
    }
    fireEvent.keyDown(document, { key: "ArrowRight" })

    expect(stepBack).not.toHaveBeenCalled()
    expect(goToMove).not.toHaveBeenCalled()
    expect(stepForward).toHaveBeenCalledTimes(1)
  })

  it("does not let a pending repeat overwrite Home, End, or Shift+arrow", () => {
    vi.useFakeTimers()
    try {
      gameState.history = Array.from({ length: 8 }, (_, index) => ({
        san: "e4",
        fen: `fen-${index}`,
        classification: index === 3 ? "blunder" : null,
      }))
      render(<Probe />)

      const holdRight = () => {
        fireEvent.keyDown(document, { key: "ArrowRight" })
        fireEvent.keyDown(document, { key: "ArrowRight" })
        fireEvent.keyDown(document, { key: "ArrowRight" })
      }

      holdRight()
      fireEvent.keyDown(document, { key: "Home" })
      vi.advanceTimersByTime(200)
      expect(goToMove).toHaveBeenCalledTimes(1)
      expect(goToMove).toHaveBeenCalledWith(0)

      goToMove.mockClear()
      stepForward.mockClear()
      holdRight()
      fireEvent.keyDown(document, { key: "End" })
      vi.advanceTimersByTime(200)
      expect(goToEnd).toHaveBeenCalledTimes(1)
      expect(goToMove).not.toHaveBeenCalled()

      goToEnd.mockClear()
      stepForward.mockClear()
      holdRight()
      fireEvent.keyDown(document, { key: "ArrowRight", shiftKey: true })
      vi.advanceTimersByTime(200)
      expect(goToMove).toHaveBeenCalledTimes(1)
      expect(goToMove).toHaveBeenCalledWith(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ["an input", <input key="input" aria-label="fen" />],
    ["a textarea", <textarea key="textarea" aria-label="pgn" />],
    ["a select", <select key="select" aria-label="side" />],
    [
      "an editable element",
      <div key="editable" aria-label="note" contentEditable="true" />,
    ],
  ])("leaves %s to the browser", (_label, field) => {
    render(
      <div>
        {field}
        <Probe />
      </div>
    )
    const target = screen.getByLabelText(
      _label === "an input"
        ? "fen"
        : _label === "a textarea"
          ? "pgn"
          : _label === "a select"
            ? "side"
            : "note"
    )
    for (const key of ["ArrowLeft", "Home", "End"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })
      target.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(stepBack).not.toHaveBeenCalled()
    expect(goToMove).not.toHaveBeenCalled()
    expect(goToEnd).not.toHaveBeenCalled()
  })

  it("ignores a key whose default was already prevented", () => {
    render(<Probe />)
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
    event.preventDefault()
    document.dispatchEvent(event)
    expect(stepForward).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([
    ["dialog", <div key="dialog" role="dialog" />],
    ["alertdialog", <div key="alert" role="alertdialog" />],
    ["native dialog", <dialog key="native" open />],
  ])("leaves keys inside an open %s", (_label, shell) => {
    render(
      <div>
        {shell}
        <Probe />
      </div>
    )
    const host = document.querySelector("[role=dialog], [role=alertdialog], dialog[open]")
    const inner = document.createElement("span")
    host?.appendChild(inner)
    for (const key of ["ArrowLeft", "Home", "End"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })
      inner.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(stepBack).not.toHaveBeenCalled()
    expect(goToMove).not.toHaveBeenCalled()
    expect(goToEnd).not.toHaveBeenCalled()
  })
})
