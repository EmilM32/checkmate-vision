import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EvalBar } from "@/components/analysis/eval-bar"

let uiState = {
  engineEnabled: false,
  guessMode: false,
  boardFlipped: false,
}

let engineState: {
  evaluation: { type: "cp" | "mate"; value: number } | null
  guessRevealed: boolean
  error: string | null
} = {
  evaluation: null,
  guessRevealed: false,
  error: null,
}

let gameState = { turn: "w" as "w" | "b", fen: "start" }

vi.mock("@/hooks/use-ui", () => ({
  useUI: () => ({ state: uiState }),
}))

vi.mock("@/hooks/use-engine", () => ({
  useEngine: () => ({ state: engineState }),
}))

vi.mock("@/hooks/use-game", () => ({
  useGame: () => ({ state: gameState }),
}))

vi.mock("@/hooks/use-i18n", () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}))

function renderBar() {
  return render(<EvalBar />)
}

afterEach(() => {
  cleanup()
  uiState = { engineEnabled: false, guessMode: false, boardFlipped: false }
  engineState = { evaluation: null, guessRevealed: false, error: null }
  gameState = { turn: "w", fen: "start" }
})

describe("EvalBar", () => {
  it("shows a plain track and no dash when the engine is off", () => {
    renderBar()
    const bar = screen.getByRole("img")
    expect(bar.getAttribute("aria-label")).toBe("evalBar.off")
    expect(bar.getAttribute("title")).toBe("evalBar.off")
    expect(bar.className).toContain("bg-muted")
    expect(bar.className).not.toContain("opacity-40")
    expect(bar.className).not.toContain("eval-bar-gradient")
    expect(bar.textContent).not.toContain("—")
    expect(screen.queryByTestId("eval-label")).toBeNull()
  })

  it("shows a waiting state instead of 0.0 before the first score", () => {
    uiState = { ...uiState, engineEnabled: true }
    renderBar()
    const bar = screen.getByRole("img")
    expect(bar.getAttribute("aria-label")).toBe("evalBar.calculating")
    expect(bar.className).toContain("eval-bar-gradient")
    expect(bar.textContent).not.toContain("0.0")
    expect(screen.queryByTestId("eval-label")).toBeNull()
  })

  it("places a white advantage at the bottom, on the light segment", () => {
    uiState = { ...uiState, engineEnabled: true }
    engineState = {
      evaluation: { type: "cp", value: 650 },
      guessRevealed: false,
      error: null,
    }
    renderBar()
    const label = screen.getByTestId("eval-label")
    expect(label.textContent).toBe("6.5")
    expect(label.className).toContain("bottom-1.5")
    expect(label.className).toContain("text-zinc-900")
    expect(label.className).toContain("text-xs")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      'evalBar.white:{"value":"6.5"}'
    )
  })

  it("moves the white advantage to the top when the board is flipped", () => {
    uiState = { ...uiState, engineEnabled: true, boardFlipped: true }
    engineState = {
      evaluation: { type: "cp", value: 650 },
      guessRevealed: false,
      error: null,
    }
    renderBar()
    const label = screen.getByTestId("eval-label")
    expect(label.className).toContain("top-1.5")
    expect(label.className).not.toContain("bottom-1.5")
  })

  it("places a black advantage at the top, on the dark segment", () => {
    uiState = { ...uiState, engineEnabled: true }
    engineState = {
      evaluation: { type: "cp", value: -80 },
      guessRevealed: false,
      error: null,
    }
    renderBar()
    const label = screen.getByTestId("eval-label")
    expect(label.textContent).toBe("0.8")
    expect(label.className).toContain("top-1.5")
    expect(label.className).toContain("text-zinc-100")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      'evalBar.black:{"value":"0.8"}'
    )
  })

  it("keeps an equal score on white's side", () => {
    uiState = { ...uiState, engineEnabled: true }
    engineState = {
      evaluation: { type: "cp", value: 0 },
      guessRevealed: false,
      error: null,
    }
    renderBar()
    const label = screen.getByTestId("eval-label")
    expect(label.textContent).toBe("0.0")
    expect(label.className).toContain("bottom-1.5")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "evalBar.equal"
    )
  })

  it("announces mate and checkmate", () => {
    uiState = { ...uiState, engineEnabled: true }
    engineState = {
      evaluation: { type: "mate", value: 3 },
      guessRevealed: false,
      error: null,
    }
    const { rerender } = renderBar()
    expect(screen.getByTestId("eval-label").textContent).toBe("M3")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      'evalBar.mateWhite:{"n":3}'
    )

    engineState = {
      evaluation: { type: "mate", value: -2 },
      guessRevealed: false,
      error: null,
    }
    rerender(<EvalBar />)
    expect(screen.getByTestId("eval-label").textContent).toBe("M2")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      'evalBar.mateBlack:{"n":2}'
    )

    gameState = { turn: "w", fen: "start" }
    engineState = {
      evaluation: { type: "mate", value: 0 },
      guessRevealed: false,
      error: null,
    }
    rerender(<EvalBar />)
    expect(screen.getByTestId("eval-label").textContent).toBe("#")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "analysis.checkmate"
    )
  })

  it("hides the score behind a question mark in guess mode", () => {
    uiState = { ...uiState, engineEnabled: true, guessMode: true }
    engineState = {
      evaluation: { type: "cp", value: 650 },
      guessRevealed: false,
      error: null,
    }
    renderBar()
    const bar = screen.getByRole("img")
    expect(bar.getAttribute("aria-label")).toBe("evalBar.hidden")
    expect(bar.textContent).toBe("?")
    expect(bar.className).toContain("bg-muted")
    expect(bar.className).not.toContain("eval-bar-gradient")
    expect(screen.queryByTestId("eval-label")).toBeNull()
  })

  it("shows a grey neutral bar when the engine has stopped", () => {
    uiState = { ...uiState, engineEnabled: true }
    engineState = {
      evaluation: { type: "cp", value: 650 },
      guessRevealed: false,
      error: "errors.engineCrashed",
    }
    const { rerender } = renderBar()
    const bar = screen.getByRole("img")
    expect(bar.getAttribute("aria-label")).toBe("evalBar.engineFailed")
    expect(bar.getAttribute("title")).toBe("evalBar.engineFailed")
    expect(bar.textContent).toBe("!")
    expect(bar.className).toContain("bg-muted")
    expect(bar.className).not.toContain("eval-bar-gradient")
    expect(bar.getAttribute("style")).toBeNull()
    expect(screen.queryByTestId("eval-label")).toBeNull()

    engineState = {
      evaluation: { type: "cp", value: 650 },
      guessRevealed: false,
      error: null,
    }
    rerender(<EvalBar />)
    expect(screen.getByTestId("eval-label").textContent).toBe("6.5")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      'evalBar.white:{"value":"6.5"}'
    )
  })

  it("keeps the fill when the next score arrives within 300 ms", () => {
    vi.useFakeTimers()
    uiState = { ...uiState, engineEnabled: true }
    engineState = {
      evaluation: { type: "cp", value: 650 },
      guessRevealed: false,
      error: null,
    }
    gameState = { turn: "w", fen: "before" }
    const { rerender } = renderBar()
    const held = screen.getByRole("img").getAttribute("data-eval-pct")
    expect(held).not.toBe("50.0")

    engineState = { ...engineState, evaluation: null }
    gameState = { turn: "w", fen: "after" }
    rerender(<EvalBar />)
    const bar = screen.getByRole("img")
    expect(bar.getAttribute("aria-label")).toBe("evalBar.calculating")
    expect(screen.queryByTestId("eval-label")).toBeNull()
    expect(bar.getAttribute("data-eval-pct")).toBe(held)

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(screen.getByRole("img").getAttribute("data-eval-pct")).toBe(held)

    engineState = {
      evaluation: { type: "cp", value: -200 },
      guessRevealed: false,
      error: null,
    }
    rerender(<EvalBar />)
    const next = screen.getByRole("img").getAttribute("data-eval-pct")
    expect(next).not.toBe("50.0")
    expect(next).not.toBe(held)
    expect(screen.getByTestId("eval-label").textContent).toBe("2.0")
    vi.useRealTimers()
  })

  it("moves the fill to the middle after 300 ms without a score", () => {
    vi.useFakeTimers()
    uiState = { ...uiState, engineEnabled: true }
    engineState = {
      evaluation: { type: "cp", value: 650 },
      guessRevealed: false,
      error: null,
    }
    gameState = { turn: "w", fen: "before" }
    const { rerender } = renderBar()
    const held = screen.getByRole("img").getAttribute("data-eval-pct")

    engineState = { ...engineState, evaluation: null }
    gameState = { turn: "w", fen: "after" }
    rerender(<EvalBar />)
    expect(screen.getByRole("img").getAttribute("data-eval-pct")).toBe(held)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByRole("img").getAttribute("data-eval-pct")).toBe("50.0")
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "evalBar.calculating"
    )
    vi.useRealTimers()
  })
})
