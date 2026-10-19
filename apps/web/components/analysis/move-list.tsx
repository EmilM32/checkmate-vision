"use client"

import { useEffect, useRef, type RefObject } from "react"

import { ScrollArea } from "@workspace/ui/components/scroll-area"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import type { MoveEntry } from "@/context/game-context"
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABEL_KEYS,
  CLASSIFICATION_SYMBOLS,
} from "@/lib/chess/classification"
import {
  getMoveNumbering,
  getPlyColor,
  getPlyMoveNumber,
} from "@/lib/chess/move-numbering"

type PlyEntry = {
  ply: number
  move: MoveEntry
}

type MoveRow = {
  moveNumber: number
  white?: PlyEntry
  black?: PlyEntry
}

function buildMoveRows(history: MoveEntry[], initialFen: string): MoveRow[] {
  const numbering = getMoveNumbering(initialFen)
  const rows: MoveRow[] = []

  history.forEach((move, index) => {
    const ply = index + 1
    const moveNumber = getPlyMoveNumber(ply, numbering)
    let row = rows.at(-1)
    if (!row || row.moveNumber !== moveNumber) {
      row = { moveNumber }
      rows.push(row)
    }
    row[getPlyColor(ply, numbering)] = { ply, move }
  })

  return rows
}

function MoveButton({
  entry,
  isActive,
  showClassification,
  activeRef,
  onSelect,
}: {
  entry: PlyEntry
  isActive: boolean
  showClassification: boolean
  activeRef: RefObject<HTMLButtonElement | null>
  onSelect: (ply: number) => void
}) {
  const { t } = useI18n()
  const classification = showClassification ? entry.move.classification : null
  const classificationLabel = classification
    ? t(CLASSIFICATION_LABEL_KEYS[classification])
    : null

  return (
    <button
      ref={isActive ? activeRef : undefined}
      onClick={() => onSelect(entry.ply)}
      title={classificationLabel ?? undefined}
      aria-label={
        classificationLabel
          ? `${entry.move.san}, ${classificationLabel}`
          : undefined
      }
      aria-current={isActive ? "step" : undefined}
      className={`flex cursor-pointer items-center gap-1 rounded px-1 text-left ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{
          backgroundColor: classification
            ? CLASSIFICATION_COLORS[classification]
            : "transparent",
        }}
      />
      {entry.move.san}
      {classification && CLASSIFICATION_SYMBOLS[classification] ? (
        <span
          aria-hidden="true"
          className="font-bold"
          style={{ color: CLASSIFICATION_COLORS[classification] }}
        >
          {CLASSIFICATION_SYMBOLS[classification]}
        </span>
      ) : null}
    </button>
  )
}

export function MoveList() {
  const { t } = useI18n()
  const { state, goToMove } = useGame()
  const { state: engineState, cancelBatchAnalysis } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [state.currentMoveIndex])

  if (state.history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {t("analysis.noMovesYet")}
      </div>
    )
  }

  const rows = buildMoveRows(state.history, state.initialFen)
  const handleSelect = (ply: number) => {
    cancelBatchAnalysis()
    goToMove(ply)
  }

  const renderCell = (entry: PlyEntry | undefined) =>
    entry ? (
      <MoveButton
        entry={entry}
        isActive={state.currentMoveIndex === entry.ply}
        showClassification={analysisVisible}
        activeRef={activeRef}
        onSelect={handleSelect}
      />
    ) : (
      <span className="px-1 text-muted-foreground">…</span>
    )

  return (
    <ScrollArea className="h-full">
      <ol className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-0.5 font-mono text-xs">
        {rows.map((row) => (
          <li
            key={row.moveNumber}
            className="col-span-3 grid grid-cols-subgrid"
          >
            <span className="pr-1 text-right text-muted-foreground">
              {row.moveNumber}.
            </span>
            {renderCell(row.white)}
            {row.black ? renderCell(row.black) : <span />}
          </li>
        ))}
      </ol>
      {state.meta.result ? (
        <p className="mt-2 text-center font-mono text-xs font-semibold text-muted-foreground">
          {state.meta.result}
        </p>
      ) : null}
    </ScrollArea>
  )
}
