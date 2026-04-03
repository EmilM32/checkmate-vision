"use client"

import { useEffect, useRef } from "react"

import { ScrollArea } from "@workspace/ui/components/scroll-area"

import { useGame } from "@/hooks/use-game"
import type { MoveEntry } from "@/context/game-context"

type MovePair = {
  moveNumber: number
  white: MoveEntry
  black?: MoveEntry
}

export function MoveList() {
  const { state, goToMove } = useGame()
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [state.currentMoveIndex])

  if (state.history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No moves yet
      </div>
    )
  }

  const pairs: MovePair[] = []
  for (let i = 0; i < state.history.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: state.history[i]!,
      black: state.history[i + 1],
    })
  }

  return (
    <ScrollArea className="h-full">
      <ol className="grid grid-cols-[2rem_1fr_1fr] gap-y-0.5 font-mono text-xs">
        {pairs.map((pair) => {
          const whiteIndex = (pair.moveNumber - 1) * 2 + 1
          const blackIndex = whiteIndex + 1
          const isWhiteActive = state.currentMoveIndex === whiteIndex
          const isBlackActive =
            pair.black && state.currentMoveIndex === blackIndex

          return (
            <li
              key={pair.moveNumber}
              className="col-span-3 grid grid-cols-subgrid"
            >
              <span className="pr-1 text-right text-muted-foreground">
                {pair.moveNumber}.
              </span>
              <button
                ref={isWhiteActive ? activeRef : undefined}
                onClick={() => goToMove(whiteIndex)}
                className={`cursor-pointer rounded px-1 text-left ${
                  isWhiteActive
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {pair.white.san}
              </button>
              {pair.black ? (
                <button
                  ref={isBlackActive ? activeRef : undefined}
                  onClick={() => goToMove(blackIndex)}
                  className={`cursor-pointer rounded px-1 text-left ${
                    isBlackActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {pair.black.san}
                </button>
              ) : (
                <span />
              )}
            </li>
          )
        })}
      </ol>
    </ScrollArea>
  )
}
