import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NavigationControls } from "@/components/navigation/navigation-controls"

const goToMove = vi.fn()
const cancelBatchAnalysis = vi.fn()

type GameStateMock = {
  currentMoveIndex: number
  history: { san: string; fen: string }[]
}

let gameState: GameStateMock = {
  currentMoveIndex: 0,
  history: [],
}

vi.mock("@/hooks/use-game", () => ({
  useGame: () => ({
    state: gameState,
    goToMove,
  }),
}))

vi.mock("@/hooks/use-engine", () => ({
  useEngine: () => ({
    cancelBatchAnalysis,
  }),
}))

describe("NavigationControls", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    gameState = {
      currentMoveIndex: 0,
      history: [
        { san: "e4", fen: "fen1" },
        { san: "e5", fen: "fen2" },
      ],
    }
    goToMove.mockReset()
    cancelBatchAnalysis.mockReset()
  })

  it("disables first/prev buttons at start", () => {
    render(<NavigationControls />)

    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(4)
    expect(buttons[0]?.hasAttribute("disabled")).toBe(true)
    expect(buttons[1]?.hasAttribute("disabled")).toBe(true)
    expect(buttons[2]?.hasAttribute("disabled")).toBe(false)
    expect(buttons[3]?.hasAttribute("disabled")).toBe(false)
  })

  it("disables next/last buttons at end", () => {
    gameState = {
      ...gameState,
      currentMoveIndex: gameState.history.length,
    }

    render(<NavigationControls />)

    const buttons = screen.getAllByRole("button")
    const first = buttons[0]!
    const prev = buttons[1]!
    const next = buttons[2]!
    const last = buttons[3]!

    fireEvent.click(first)
    fireEvent.click(prev)
    fireEvent.click(next)
    fireEvent.click(last)

    expect(cancelBatchAnalysis).toHaveBeenCalledTimes(2)
    expect(goToMove).toHaveBeenNthCalledWith(1, 0)
    expect(goToMove).toHaveBeenNthCalledWith(2, 1)
  })

  it("clicking controls cancels batch and navigates", () => {
    gameState = {
      ...gameState,
      currentMoveIndex: 0,
    }

    render(<NavigationControls />)

    const buttons = screen.getAllByRole("button")
    const next = buttons[2]!
    const last = buttons[3]!
    fireEvent.click(next)
    fireEvent.click(last)

    expect(cancelBatchAnalysis).toHaveBeenCalledTimes(2)
    expect(goToMove).toHaveBeenNthCalledWith(1, 1)
    expect(goToMove).toHaveBeenNthCalledWith(2, 2)
  })

  it("responds to keyboard navigation shortcuts", () => {
    gameState = {
      ...gameState,
      currentMoveIndex: 1,
    }

    render(<NavigationControls />)

    fireEvent.keyDown(document, { key: "ArrowLeft" })
    fireEvent.keyDown(document, { key: "ArrowRight" })
    fireEvent.keyDown(document, { key: "Home" })
    fireEvent.keyDown(document, { key: "End" })

    expect(goToMove).toHaveBeenNthCalledWith(1, 0)
    expect(goToMove).toHaveBeenNthCalledWith(2, 2)
    expect(goToMove).toHaveBeenNthCalledWith(3, 0)
    expect(goToMove).toHaveBeenNthCalledWith(4, 2)
    expect(cancelBatchAnalysis).toHaveBeenCalledTimes(4)
  })

  it("ignores keyboard shortcuts while typing in form fields", () => {
    render(
      <div>
        <input aria-label="fen" />
        <NavigationControls />
      </div>
    )

    const input = screen.getByRole("textbox", { name: "fen" })
    fireEvent.keyDown(input, { key: "ArrowRight" })

    expect(goToMove).not.toHaveBeenCalled()
    expect(cancelBatchAnalysis).not.toHaveBeenCalled()
  })
})
