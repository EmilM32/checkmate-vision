"use client"

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"

export type HeatmapMode = "net" | "split"

export type UIState = {
  showHeatmap: boolean
  heatmapMode: HeatmapMode
  showInfluenceTrace: boolean
  selectedInfluenceSquare: string | null
  showArrows: boolean
  sleuthMode: boolean
  boardFlipped: boolean
  showEvalChart: boolean
  engineEnabled: boolean
}

export const initialUIState: UIState = {
  showHeatmap: true,
  heatmapMode: "net",
  showInfluenceTrace: true,
  selectedInfluenceSquare: null,
  showArrows: true,
  sleuthMode: false,
  boardFlipped: false,
  showEvalChart: false,
  engineEnabled: false,
}

export type UIAction =
  | { type: "UI_TOGGLE_ARROWS" }
  | { type: "UI_TOGGLE_HEATMAP" }
  | { type: "UI_SET_HEATMAP_MODE"; payload: HeatmapMode }
  | { type: "UI_TOGGLE_INFLUENCE_TRACE" }
  | { type: "UI_SET_INFLUENCE_SQUARE"; payload: string | null }
  | { type: "UI_CLEAR_INFLUENCE_SQUARE" }
  | { type: "UI_TOGGLE_SLEUTH_MODE" }
  | { type: "UI_TOGGLE_BOARD_FLIPPED" }
  | { type: "UI_TOGGLE_EVAL_CHART" }
  | { type: "UI_TOGGLE_ENGINE" }
  | { type: "UI_RESTORE_STATE"; payload: UIState }
  | { type: "UI_RESET" }

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "UI_TOGGLE_ARROWS":
      return {
        ...state,
        showArrows: !state.showArrows,
      }
    case "UI_TOGGLE_HEATMAP":
      return {
        ...state,
        showHeatmap: !state.showHeatmap,
        selectedInfluenceSquare: state.showHeatmap
          ? null
          : state.selectedInfluenceSquare,
      }
    case "UI_SET_HEATMAP_MODE":
      return {
        ...state,
        heatmapMode: action.payload,
      }
    case "UI_TOGGLE_INFLUENCE_TRACE":
      return {
        ...state,
        showInfluenceTrace: !state.showInfluenceTrace,
      }
    case "UI_SET_INFLUENCE_SQUARE":
      return {
        ...state,
        selectedInfluenceSquare: action.payload,
      }
    case "UI_CLEAR_INFLUENCE_SQUARE":
      return {
        ...state,
        selectedInfluenceSquare: null,
      }
    case "UI_TOGGLE_SLEUTH_MODE":
      return {
        ...state,
        sleuthMode: !state.sleuthMode,
      }
    case "UI_TOGGLE_BOARD_FLIPPED":
      return {
        ...state,
        boardFlipped: !state.boardFlipped,
      }
    case "UI_TOGGLE_EVAL_CHART":
      return {
        ...state,
        showEvalChart: !state.showEvalChart,
      }
    case "UI_TOGGLE_ENGINE":
      return {
        ...state,
        engineEnabled: !state.engineEnabled,
      }
    case "UI_RESTORE_STATE":
      return {
        ...initialUIState,
        ...action.payload,
      }
    case "UI_RESET":
      return initialUIState
  }
}

type UIContextValue = {
  state: UIState
  dispatch: Dispatch<UIAction>
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialUIState)

  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUIContext() {
  const context = useContext(UIContext)

  if (!context) {
    throw new Error("useUIContext must be used within UIProvider")
  }

  return context
}
