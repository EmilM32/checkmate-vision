"use client"

import type { ReactNode } from "react"

import { EngineConnector } from "@/components/analysis/engine-connector"
import { EngineProvider } from "@/context/engine-context"
import { GameProvider } from "@/context/game-context"
import { UIProvider } from "@/context/ui-context"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GameProvider>
      <EngineProvider>
        <EngineConnector />
        <UIProvider>{children}</UIProvider>
      </EngineProvider>
    </GameProvider>
  )
}

export { useEngineContext } from "@/context/engine-context"
export { useGameContext } from "@/context/game-context"
export { useUIContext } from "@/context/ui-context"
