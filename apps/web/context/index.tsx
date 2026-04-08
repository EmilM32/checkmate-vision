"use client"

import { useEffect, useRef, type ReactNode } from "react"

import { EngineConnector } from "@/components/analysis/engine-connector"
import { EngineProvider, useEngineContext } from "@/context/engine-context"
import { GameProvider, useGameContext } from "@/context/game-context"
import { UIProvider, useUIContext } from "@/context/ui-context"
import {
  clearPersistedSession,
  readPersistedSession,
  selectPersistableEngineState,
  writePersistedSession,
} from "@/lib/persistence/session-storage"

const AUTOSAVE_DELAY_MS = 350

function SessionPersistenceBridge() {
  const { state: gameState, restoreState } = useGameContext()
  const { state: engineState, dispatch: engineDispatch } = useEngineContext()
  const { state: uiState, dispatch: uiDispatch } = useUIContext()

  const hasHydratedRef = useRef(false)

  useEffect(() => {
    if (hasHydratedRef.current) return

    hasHydratedRef.current = true
    const persistedSession = readPersistedSession()
    if (!persistedSession) return

    const restored = restoreState(persistedSession.game)
    if (!restored) {
      clearPersistedSession()
      return
    }

    uiDispatch({ type: "UI_RESTORE_STATE", payload: persistedSession.ui })
    engineDispatch({
      type: "ENGINE_RESTORE_STATE",
      payload: persistedSession.engine,
    })
  }, [restoreState, uiDispatch, engineDispatch])

  useEffect(() => {
    if (!hasHydratedRef.current) return

    const timeoutId = window.setTimeout(() => {
      writePersistedSession({
        game: gameState,
        ui: uiState,
        engine: selectPersistableEngineState(engineState),
      })
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [gameState, uiState, engineState])

  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GameProvider>
      <EngineProvider>
        <UIProvider>
          <SessionPersistenceBridge />
          <EngineConnector />
          {children}
        </UIProvider>
      </EngineProvider>
    </GameProvider>
  )
}

export { useEngineContext } from "@/context/engine-context"
export { useGameContext } from "@/context/game-context"
export { useUIContext } from "@/context/ui-context"
