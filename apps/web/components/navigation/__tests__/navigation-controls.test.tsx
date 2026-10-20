import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NavigationControls } from "@/components/navigation/navigation-controls"

const goToMove = vi.fn()
const stepForward = vi.fn()
const stepBack = vi.fn()
const goToEnd = vi.fn()

type GameStateMock = {
  currentMoveIndex: number
  history: { san: string; fen: string }[]
  variation: { branchIndex: number; moves: { san: string }[] } | null
  variationIndex: number | null
}

let gameState: GameStateMock = {
  currentMoveIndex: 0,
  history: [],
  variation: null,
  variationIndex: null,
}

vi.mock("@/hooks/use-game", () => ({
  useGame: () => ({
    state: gameState,
    goToMove,
    stepForward,
    stepBack,
    goToEnd,
  }),
}))

vi.mock("@/hooks/use-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
      variation: null,
      variationIndex: null,
    }
    for (const fn of [goToMove, stepForward, stepBack, goToEnd]) {
      fn.mockReset()
    }
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

    expect(next.hasAttribute("disabled")).toBe(true)
    expect(last.hasAttribute("disabled")).toBe(true)

    fireEvent.click(first)
    fireEvent.click(prev)
    expect(goToMove).toHaveBeenCalledWith(0)
    expect(stepBack).toHaveBeenCalledTimes(1)
  })

  it("clicking controls navigates", () => {
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
    expect(stepForward).toHaveBeenCalledTimes(1)
    expect(goToEnd).toHaveBeenCalledTimes(1)
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

    expect(stepBack).toHaveBeenCalledTimes(1)
    expect(stepForward).toHaveBeenCalledTimes(1)
    expect(goToMove).toHaveBeenCalledWith(0)
    expect(goToEnd).toHaveBeenCalledTimes(1)
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

    expect(stepForward).not.toHaveBeenCalled()
  })

  it("keeps the arrows active inside a variation that starts at move 0", () => {
    gameState = {
      ...gameState,
      currentMoveIndex: 0,
      variation: { branchIndex: 0, moves: [{ san: "d4" }, { san: "d5" }] },
      variationIndex: 1,
    }

    render(<NavigationControls />)

    const buttons = screen.getAllByRole("button")
    // Back leads to the main line; forward continues the variation.
    expect(buttons[1]?.hasAttribute("disabled")).toBe(false)
    expect(buttons[2]?.hasAttribute("disabled")).toBe(false)
  })

  it("labels the navigation buttons for assistive technology", () => {
    render(<NavigationControls />)

    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual([
      "navigation.first",
      "navigation.previous",
      "navigation.next",
      "navigation.last",
    ])
  })
})
