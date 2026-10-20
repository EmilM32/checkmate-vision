"use client"

import { Fragment, useEffect, useRef, type RefObject } from "react"

import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { CornerUpLeft, X } from "lucide-react"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import type { MoveEntry, Variation } from "@/context/game-context"
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

// The side line under the main move it replaces, Lichess-style:
// "(10... Nd7 11. Qb3 Qe7)", with buttons to return to the game or drop it.
function VariationLine({
  variation,
  initialFen,
  activeIndex,
  activeRef,
  showClassification,
  onSelect,
  onBack,
  onDelete,
}: {
  variation: Variation
  showClassification: boolean
  initialFen: string
  activeIndex: number | null
  activeRef: RefObject<HTMLButtonElement | null>
  onSelect: (index: number) => void
  onBack: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const numbering = getMoveNumbering(initialFen)

  return (
    <li
      className="col-span-3 my-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md border-l-2 border-primary/50 bg-muted/40 py-1 pr-1 pl-2"
      aria-label={t("variation.label")}
      data-testid="variation"
    >
      {variation.moves.map((move, i) => {
        const index = i + 1
        const ply = variation.branchIndex + index
        const isWhite = getPlyColor(ply, numbering) === "white"
        const number = getPlyMoveNumber(ply, numbering)
        const prefix = isWhite ? `${number}.` : i === 0 ? `${number}...` : null
        const isActive = activeIndex === index
        return (
          <span key={index} className="inline-flex items-center gap-0.5">
            {prefix ? (
              <span className="text-muted-foreground">{prefix}</span>
            ) : null}
            <button
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(index)}
              aria-current={isActive ? "step" : undefined}
              className={`cursor-pointer rounded px-1 ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80 hover:bg-muted"
              }`}
            >
              {move.san}
              {showClassification &&
              move.classification &&
              CLASSIFICATION_SYMBOLS[move.classification] ? (
                <span
                  className="font-bold"
                  style={{ color: CLASSIFICATION_COLORS[move.classification] }}
                >
                  {CLASSIFICATION_SYMBOLS[move.classification]}
                </span>
              ) : null}
            </button>
          </span>
        )
      })}
      <span className="ml-auto inline-flex items-center gap-0.5">
        <button
          onClick={onBack}
          title={t("variation.backToGame")}
          aria-label={t("variation.backToGame")}
          className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CornerUpLeft className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          title={t("variation.delete")}
          aria-label={t("variation.delete")}
          className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </span>
    </li>
  )
}

export function MoveList() {
  const { t } = useI18n()
  const { state, goToMove, goToVariationMove, deleteVariation } = useGame()
  const { state: engineState } = useEngine()
  const { state: uiState } = useUI()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [state.currentMoveIndex, state.variationIndex])

  if (state.history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {t("analysis.noMovesYet")}
      </div>
    )
  }

  const rows = buildMoveRows(state.history, state.initialFen)
  const handleSelect = (ply: number) => goToMove(ply)
  // The variation is listed under the row of the main move it replaces.
  const variation = state.variation
  const variationRow = variation
    ? (rows.find((row) =>
        [row.white?.ply, row.black?.ply].includes(variation.branchIndex + 1)
      ) ?? rows.at(-1))
    : undefined

  const renderCell = (entry: PlyEntry | undefined) =>
    entry ? (
      <MoveButton
        entry={entry}
        isActive={
          state.variationIndex === null && state.currentMoveIndex === entry.ply
        }
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
          <Fragment key={row.moveNumber}>
            <li className="col-span-3 grid grid-cols-subgrid">
              <span className="pr-1 text-right text-muted-foreground">
                {row.moveNumber}.
              </span>
              {renderCell(row.white)}
              {row.black ? renderCell(row.black) : <span />}
            </li>
            {variation && row === variationRow ? (
              <VariationLine
                variation={variation}
                initialFen={state.initialFen}
                activeIndex={state.variationIndex}
                activeRef={activeRef}
                showClassification={analysisVisible}
                onSelect={goToVariationMove}
                onBack={() => goToMove(variation.branchIndex)}
                onDelete={deleteVariation}
              />
            ) : null}
          </Fragment>
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
