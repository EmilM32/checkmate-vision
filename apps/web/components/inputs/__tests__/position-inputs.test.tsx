import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FENInput } from "@/components/inputs/fen-input"
import { PGNInput } from "@/components/inputs/pgn-input"

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const NEXT_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
const IMPOSSIBLE_FEN = "4k3/4R3/8/8/8/8/8/4K3 w - - 0 1"

const {
  localeRef,
  fenRef,
  setPositionFromFen,
  loadPgnGame,
  clearBatchAnalysis,
} = vi.hoisted(() => ({
  localeRef: { current: "pl" as "pl" | "en" },
  fenRef: {
    current: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  },
  setPositionFromFen: vi.fn(() => true),
  loadPgnGame: vi.fn(() => true),
  clearBatchAnalysis: vi.fn(),
}))

function lookup(dictionary: Record<string, unknown>, key: string): string {
  const value = key.split(".").reduce<unknown>((acc, token) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[token]
    }
    return undefined
  }, dictionary)
  return typeof value === "string" ? value : key
}

vi.mock("@/hooks/use-i18n", async () => {
  const pl = (await import("@/i18n/dictionaries/pl.json")).default
  const en = (await import("@/i18n/dictionaries/en.json")).default
  return {
    useI18n: () => ({
      t: (key: string) => lookup(localeRef.current === "en" ? en : pl, key),
    }),
  }
})

vi.mock("@/hooks/use-game", () => ({
  useGame: () => ({
    state: { fen: fenRef.current },
    setPositionFromFen,
    loadPgnGame,
  }),
}))

vi.mock("@/hooks/use-engine", () => ({
  useEngine: () => ({
    state: { batch: { status: "idle" } },
    clearBatchAnalysis,
  }),
}))

const FEN_NAME = {
  pl: "FEN – pozycja startowa w zapisie FEN",
  en: "FEN – starting position in FEN notation",
}
const PGN_NAME = {
  pl: "PGN – zapis partii w formacie PGN",
  en: "PGN – game record in PGN format",
}

describe("FEN input", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localeRef.current = "pl"
    fenRef.current = START_FEN
    setPositionFromFen.mockReset()
    setPositionFromFen.mockReturnValue(true)
  })

  it("names the field from the visible label and the format hint", () => {
    render(<FENInput />)

    const field = screen.getByRole("textbox", { name: FEN_NAME.pl })
    expect(field.tagName).toBe("INPUT")
    expect(field.getAttribute("aria-invalid")).toBeNull()
    expect(field.getAttribute("aria-describedby")).toBeNull()
  })

  it("names the field in English", () => {
    localeRef.current = "en"
    render(<FENInput />)

    expect(screen.getByRole("textbox", { name: FEN_NAME.en }).tagName).toBe(
      "INPUT"
    )
  })

  it("focuses the field when its label is clicked", async () => {
    const user = userEvent.setup()
    render(<FENInput />)

    const field = screen.getByRole("textbox", { name: FEN_NAME.pl })
    if (!(field instanceof HTMLInputElement)) {
      throw new Error("FEN field is not an input")
    }
    const label = field.labels?.[0]
    expect(label?.textContent?.startsWith("FEN")).toBe(true)
    await user.click(label!)
    expect(document.activeElement).toBe(field)
  })

  it("announces an empty FEN again on the next attempt, then clears it", async () => {
    const user = userEvent.setup()
    render(<FENInput />)

    const field = screen.getByRole("textbox", { name: FEN_NAME.pl })
    const submit = screen.getByRole("button", { name: "Ustaw FEN" })
    await user.clear(field)
    await user.click(submit)

    const firstAlert = screen.getByRole("alert")
    expect(firstAlert.textContent).toBe("FEN nie może być pusty.")
    expect(field.getAttribute("aria-invalid")).toBe("true")
    expect(field.getAttribute("aria-describedby")).toBe(firstAlert.id)
    expect(setPositionFromFen).not.toHaveBeenCalled()

    await user.click(submit)
    const secondAlert = screen.getByRole("alert")
    expect(secondAlert).not.toBe(firstAlert)
    expect(secondAlert.textContent).toBe("FEN nie może być pusty.")
    expect(field.getAttribute("aria-describedby")).toBe(secondAlert.id)

    await user.type(field, NEXT_FEN)
    await user.click(submit)

    expect(screen.queryByRole("alert")).toBeNull()
    expect(field.getAttribute("aria-invalid")).toBeNull()
    expect(field.getAttribute("aria-describedby")).toBeNull()
    expect(setPositionFromFen).toHaveBeenCalledWith(NEXT_FEN)
  })

  it("announces a position where the side not to move is in check", async () => {
    const user = userEvent.setup()
    render(<FENInput />)

    const field = screen.getByRole("textbox", { name: FEN_NAME.pl })
    await user.clear(field)
    await user.type(field, IMPOSSIBLE_FEN)
    await user.click(screen.getByRole("button", { name: "Ustaw FEN" }))

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toBe(
      "Ta pozycja jest niemożliwa: król strony, która nie ma ruchu, jest w szachu."
    )
    expect(field.getAttribute("aria-invalid")).toBe("true")
    expect(field.getAttribute("aria-describedby")).toBe(alert.id)
    expect(setPositionFromFen).not.toHaveBeenCalled()
  })

  it("announces that impossible position in English", async () => {
    localeRef.current = "en"
    const user = userEvent.setup()
    render(<FENInput />)

    const field = screen.getByRole("textbox", { name: FEN_NAME.en })
    await user.clear(field)
    await user.type(field, IMPOSSIBLE_FEN)
    await user.click(screen.getByRole("button", { name: "Set FEN" }))

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toBe(
      "This position is impossible: the king of the side not to move is in check."
    )
    expect(field.getAttribute("aria-invalid")).toBe("true")
    expect(field.getAttribute("aria-describedby")).toBe(alert.id)
    expect(setPositionFromFen).not.toHaveBeenCalled()
  })

  it("announces a position the board refused to set", async () => {
    setPositionFromFen.mockReturnValue(false)
    const user = userEvent.setup()
    render(<FENInput />)

    const field = screen.getByRole("textbox", { name: FEN_NAME.pl })
    await user.clear(field)
    await user.type(field, NEXT_FEN)
    await user.click(screen.getByRole("button", { name: "Ustaw FEN" }))

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toBe("Nie udało się ustawić pozycji FEN.")
    expect(field.getAttribute("aria-describedby")).toBe(alert.id)
  })
})

describe("PGN input", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localeRef.current = "pl"
    loadPgnGame.mockReset()
    loadPgnGame.mockReturnValue(true)
    clearBatchAnalysis.mockReset()
  })

  it("names the field from the visible label and the format hint", () => {
    render(<PGNInput />)

    const field = screen.getByRole("textbox", { name: PGN_NAME.pl })
    expect(field.tagName).toBe("TEXTAREA")
    expect(field.getAttribute("placeholder")).toBe("Wklej PGN...")
  })

  it("names the field in English", () => {
    localeRef.current = "en"
    render(<PGNInput />)

    expect(screen.getByRole("textbox", { name: PGN_NAME.en }).tagName).toBe(
      "TEXTAREA"
    )
  })

  it("announces a PGN without moves again, then clears it after a load", async () => {
    const user = userEvent.setup()
    render(<PGNInput />)

    const field = screen.getByRole("textbox", { name: PGN_NAME.pl })
    const submit = screen.getByRole("button", { name: "Wczytaj PGN" })
    fireEvent.change(field, { target: { value: '[Event "Test"]' } })
    await user.click(submit)

    const firstAlert = screen.getByRole("alert")
    expect(firstAlert.textContent).toBe("PGN nie zawiera ruchów.")
    expect(field.getAttribute("aria-invalid")).toBe("true")
    expect(field.getAttribute("aria-describedby")).toBe(firstAlert.id)
    expect(loadPgnGame).not.toHaveBeenCalled()

    await user.click(submit)
    const secondAlert = screen.getByRole("alert")
    expect(secondAlert).not.toBe(firstAlert)
    expect(secondAlert.textContent).toBe("PGN nie zawiera ruchów.")

    fireEvent.change(field, { target: { value: "1. e4 e5" } })
    await user.click(submit)

    expect(screen.queryByRole("alert")).toBeNull()
    expect(field.getAttribute("aria-invalid")).toBeNull()
    expect(field.getAttribute("aria-describedby")).toBeNull()
    expect(loadPgnGame).toHaveBeenCalledOnce()
    expect(clearBatchAnalysis).toHaveBeenCalledOnce()
  })

  it("announces a game the board refused to load", async () => {
    loadPgnGame.mockReturnValue(false)
    const user = userEvent.setup()
    render(<PGNInput />)

    const field = screen.getByRole("textbox", { name: PGN_NAME.pl })
    fireEvent.change(field, { target: { value: "1. e4" } })
    await user.click(screen.getByRole("button", { name: "Wczytaj PGN" }))

    expect(screen.getByRole("alert").textContent).toBe(
      "Nie udało się załadować partii."
    )
    expect(field.getAttribute("aria-invalid")).toBe("true")
    expect(clearBatchAnalysis).not.toHaveBeenCalled()
  })
})
