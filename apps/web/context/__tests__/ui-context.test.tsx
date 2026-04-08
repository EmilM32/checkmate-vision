import React from "react"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { UIProvider, initialUIState, useUIContext } from "@/context/ui-context"

type UIApi = ReturnType<typeof useUIContext>

function renderUIHarness() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UIProvider>{children}</UIProvider>
  )

  const { result } = renderHook(() => useUIContext(), { wrapper })

  return {
    getApi() {
      return result.current as UIApi
    },
  }
}

describe("UIContext", () => {
  it("toggles each UI flag independently", () => {
    const harness = renderUIHarness()

    act(() => {
      const { dispatch } = harness.getApi()
      dispatch({ type: "UI_TOGGLE_ARROWS" })
      dispatch({ type: "UI_TOGGLE_HEATMAP" })
      dispatch({ type: "UI_TOGGLE_SLEUTH_MODE" })
      dispatch({ type: "UI_TOGGLE_BOARD_FLIPPED" })
      dispatch({ type: "UI_TOGGLE_EVAL_CHART" })
    })

    const state = harness.getApi().state
    expect(state.showArrows).toBe(false)
    expect(state.showHeatmap).toBe(false)
    expect(state.heatmapMode).toBe("net")
    expect(state.sleuthMode).toBe(true)
    expect(state.boardFlipped).toBe(true)
    expect(state.showEvalChart).toBe(true)
  })

  it("toggle twice returns to initial state", () => {
    const harness = renderUIHarness()

    act(() => {
      const { dispatch } = harness.getApi()
      dispatch({ type: "UI_TOGGLE_ARROWS" })
      dispatch({ type: "UI_TOGGLE_ARROWS" })
      dispatch({ type: "UI_TOGGLE_HEATMAP" })
      dispatch({ type: "UI_TOGGLE_HEATMAP" })
      dispatch({ type: "UI_SET_HEATMAP_MODE", payload: "split" })
      dispatch({ type: "UI_SET_HEATMAP_MODE", payload: "net" })
      dispatch({ type: "UI_TOGGLE_SLEUTH_MODE" })
      dispatch({ type: "UI_TOGGLE_SLEUTH_MODE" })
      dispatch({ type: "UI_TOGGLE_BOARD_FLIPPED" })
      dispatch({ type: "UI_TOGGLE_BOARD_FLIPPED" })
      dispatch({ type: "UI_TOGGLE_EVAL_CHART" })
      dispatch({ type: "UI_TOGGLE_EVAL_CHART" })
    })

    expect(harness.getApi().state).toEqual(initialUIState)
  })

  it("restores state snapshot and supports reset", () => {
    const harness = renderUIHarness()

    act(() => {
      harness.getApi().dispatch({
        type: "UI_RESTORE_STATE",
        payload: {
          showArrows: false,
          showHeatmap: false,
          heatmapMode: "split",
          sleuthMode: true,
          boardFlipped: true,
          showEvalChart: true,
        },
      })
    })

    expect(harness.getApi().state).toEqual({
      showArrows: false,
      showHeatmap: false,
      heatmapMode: "split",
      sleuthMode: true,
      boardFlipped: true,
      showEvalChart: true,
    })

    act(() => {
      harness.getApi().dispatch({ type: "UI_RESET" })
    })

    expect(harness.getApi().state).toEqual(initialUIState)
  })
})
