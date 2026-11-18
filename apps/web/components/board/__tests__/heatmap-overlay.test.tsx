import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_POSITION } from "chess.js"

import { HeatmapOverlay } from "@/components/board/heatmap-overlay"

vi.mock("@/hooks/use-game", () => ({
  useGame: () => ({
    state: { fen: DEFAULT_POSITION },
  }),
}))

vi.mock("@/hooks/use-ui", () => ({
  useUI: () => ({
    state: {
      showHeatmap: true,
      heatmapMode: "net" as const,
      showInfluenceTrace: true,
      selectedInfluenceSquare: "e4",
      boardFlipped: false,
    },
  }),
}))

vi.mock("@/hooks/use-reduced-motion", () => ({
  usePrefersReducedMotion: () => false,
}))

describe("HeatmapOverlay influence pulse", () => {
  const originalAnimate = Element.prototype.animate

  afterEach(() => {
    cleanup()
    Element.prototype.animate = originalAnimate
  })

  it("writes a finite radius when a square is selected", async () => {
    // Cancelling the pulse rejects the animation's finished promise.
    Element.prototype.animate = function (
      this: Element,
      ...args: Parameters<Element["animate"]>
    ) {
      const animation = originalAnimate.apply(this, args)
      animation.finished.catch(() => {})
      return animation
    }

    const setAttribute = vi.spyOn(Element.prototype, "setAttribute")
    render(<HeatmapOverlay />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    const radii = setAttribute.mock.calls
      .filter(([name]) => name === "r")
      .map(([, value]) => String(value))
    setAttribute.mockRestore()

    expect(radii.length).toBeGreaterThan(0)
    for (const radius of radii) {
      expect(radius).not.toBe("undefined")
      expect(Number.isFinite(Number(radius))).toBe(true)
    }

    for (const circle of document.querySelectorAll("circle")) {
      expect(Number.isFinite(Number(circle.getAttribute("r")))).toBe(true)
    }
  })
})
