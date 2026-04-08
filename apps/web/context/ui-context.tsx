"use client"

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"

export type UIState = {
  showHeatmap: boolean
  showArrows: boolean
  sleuthMode: boolean
  boardFlipped: boolean
}

export const initialUIState: UIState = {
  showHeatmap: true,
  showArrows: true,
  sleuthMode: false,
  boardFlipped: false,
}

export type UIAction =
  | { type: "UI_TOGGLE_ARROWS" }
  | { type: "UI_TOGGLE_HEATMAP" }
  | { type: "UI_TOGGLE_SLEUTH_MODE" }
  | { type: "UI_TOGGLE_BOARD_FLIPPED" }
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
    case "UI_RESTORE_STATE":
      return action.payload
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
