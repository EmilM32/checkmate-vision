"use client"

import { useEngineContext } from "@/context"

export function useEngine() {
  const { state } = useEngineContext()
  return { state }
}
