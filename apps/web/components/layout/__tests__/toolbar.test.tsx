import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ToolbarPlaceholder } from "@/components/layout/toolbar"

const dispatch = vi.fn()
const revealAnalysis = vi.fn()
const concealAnalysis = vi.fn()
const setLocale = vi.fn()

let uiState = {
  showHeatmap: true,
  heatmapMode: "net" as const,
  showArrows: true,
  sleuthMode: false,
  boardFlipped: false,
  showEvalChart: false,
}

let engineState = {
  sleuthRevealed: false,
}

vi.mock("@/hooks/use-ui", () => ({
  useUI: () => ({
    state: uiState,
    dispatch,
  }),
}))

vi.mock("@/hooks/use-engine", () => ({
  useEngine: () => ({
    state: engineState,
    revealAnalysis,
    concealAnalysis,
  }),
}))

vi.mock("@/hooks/use-i18n", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale,
    isSwitchingLocale: false,
    t: (key: string) => {
      const dictionary: Record<string, string> = {
        "toolbar.heatmap": "Heatmap",
        "toolbar.arrows": "Arrows",
        "toolbar.sleuth": "Sleuth",
        "toolbar.chart": "Chart",
        "toolbar.export": "Export",
        "toolbar.flip": "Flip",
        "common.reveal": "Reveal",
        "common.new": "New",
        "language.label": "Language",
        "language.pl": "PL",
        "language.en": "EN",
        "heatmap.modeNetShort": "NET",
        "heatmap.modeSplitShort": "SPLIT",
        "heatmap.modeToggle": "Switch heatmap mode",
      }

      return dictionary[key] ?? key
    },
  }),
}))

describe("ToolbarPlaceholder", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    dispatch.mockReset()
    revealAnalysis.mockReset()
    concealAnalysis.mockReset()
    setLocale.mockReset()
    uiState = {
      showHeatmap: true,
      heatmapMode: "net",
      showArrows: true,
      sleuthMode: false,
      boardFlipped: false,
      showEvalChart: false,
    }
    engineState = {
      sleuthRevealed: false,
    }
  })

  it("shows heatmap mode switch while heatmap is enabled", () => {
    render(<ToolbarPlaceholder onExport={vi.fn()} onNewAnalysis={vi.fn()} />)

    expect(screen.getByRole("button", { name: "NET" })).toBeTruthy()
  })

  it("cycles heatmap mode from net to split", () => {
    render(<ToolbarPlaceholder onExport={vi.fn()} onNewAnalysis={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "NET" }))

    expect(dispatch).toHaveBeenCalledWith({
      type: "UI_SET_HEATMAP_MODE",
      payload: "split",
    })
  })

  it("hides heatmap mode switch when heatmap overlay is disabled", () => {
    uiState = {
      ...uiState,
      showHeatmap: false,
    }

    render(<ToolbarPlaceholder onExport={vi.fn()} onNewAnalysis={vi.fn()} />)

    expect(screen.queryByRole("button", { name: "NET" })).toBeNull()
  })
})
