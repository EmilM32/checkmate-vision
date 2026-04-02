"use client"

import type { ReactNode } from "react"

import { EngineProvider } from "@/context/engine-context"
import { GameProvider } from "@/context/game-context"
import { UIProvider } from "@/context/ui-context"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GameProvider>
      <EngineProvider>
        <UIProvider>{children}</UIProvider>
      </EngineProvider>
    </GameProvider>
  )
}

export { useEngineContext } from "@/context/engine-context"
export { useGameContext } from "@/context/game-context"
export { useUIContext } from "@/context/ui-context"
