"use client"

import { createContext, useContext, type ReactNode } from "react"

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

type UIContextValue = {
  state: UIState
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <UIContext.Provider value={{ state: initialUIState }}>
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
