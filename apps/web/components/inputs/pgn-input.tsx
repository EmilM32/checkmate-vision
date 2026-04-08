"use client"

import { useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { parsePgn } from "@/lib/chess/fen-pgn"

export function PGNInput() {
  const { state, loadPgnGame } = useGame()
  const { state: engineState, requestBatchAnalysis, clearBatchAnalysis } =
    useEngine()

  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  const isBatchRunning = engineState.batch.status === "running"

  const canAnalyze = useMemo(() => {
    return state.history.length > 0 && !isBatchRunning
  }, [state.history.length, isBatchRunning])

  function handleLoadPgn() {
    setError(null)
    const parsed = parsePgn(value)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    const ok = loadPgnGame(parsed.data)
    if (!ok) {
      setError("Nie udalo sie zaladowac partii.")
      return
    }

    setValue(parsed.data.pgn)
    clearBatchAnalysis()
  }

  function handleAnalyzeBatch() {
    setError(null)
    if (state.history.length === 0) {
      setError("Najpierw wczytaj PGN z ruchami.")
      return
    }

    const queue = [
      { moveIndex: 0, fen: state.initialFen, fenBefore: state.initialFen },
      ...state.history.map((move, index) => ({
        moveIndex: index + 1,
        fen: move.fen,
        fenBefore: index === 0 ? state.initialFen : state.history[index - 1]!.fen,
      })),
    ]

    requestBatchAnalysis(queue)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">PGN</label>
      <Textarea
        placeholder="Wklej PGN..."
        className="min-h-20 font-mono text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={Boolean(error)}
        disabled={isBatchRunning}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleLoadPgn} disabled={isBatchRunning}>
          Wczytaj PGN
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAnalyzeBatch}
          disabled={!canAnalyze}
        >
          Analizuj partie
        </Button>
      </div>
    </div>
  )
}
