import { Chess } from "chess.js"

import type {
  EngineScore,
  EngineState,
  PersistableEngineState,
} from "@/context/engine-context"
import type { GameState, MoveEntry, Variation } from "@/context/game-context"
import { initialUIState, type UIState } from "@/context/ui-context"
import type { MoveClassification } from "@/lib/chess/classification"
import { validateFen } from "@/lib/chess/fen-pgn"

export const SESSION_STORAGE_KEY = "checkmate-vision:session"
export const SESSION_SCHEMA_VERSION = 3

type PersistedSessionShape<Version extends number> = {
  schemaVersion: Version
  savedAt: string
  game: GameState
  ui: UIState
  engine: PersistableEngineState
}

// v1 stored engine scores from the side-to-move perspective (and move
// classifications derived from them); v2 stores them from White's perspective;
// v3 classifies moves by win chance.
export type PersistedSessionV1 = PersistedSessionShape<1>
export type PersistedSessionV2 = PersistedSessionShape<2>
export type PersistedSessionV3 = PersistedSessionShape<3>

type PersistedSession = PersistedSessionV3

type PersistedSessionInput = {
  game: GameState
  ui: UIState
  engine: PersistableEngineState
}

const SQUARE_PATTERN = /^[a-h][1-8]$/

const CLASSIFICATIONS = {
  brilliant: true,
  great: true,
  best: true,
  good: true,
  inaccuracy: true,
  mistake: true,
  blunder: true,
} satisfies Record<MoveClassification, true>

const SCORE_TYPES = {
  cp: true,
  mate: true,
} satisfies Record<Exclude<EngineScore, null>["type"], true>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value)
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined)
  ) as T
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, index) => sameValue(item, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (!sameValue(left[key], right[key])) return false
  }
  return true
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

// `null` means nothing is selected. Anything else must be a real square;
// "E4" and surrounding space are stored as "e4".
function sanitizeSquare(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== "string") return null
  const square = value.trim().toLowerCase()
  return SQUARE_PATTERN.test(square) ? square : null
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeElo(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null
  }
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || !Number.isFinite(Number(trimmed))) return null
  return trimmed
}

function sanitizeMeta(value: unknown): GameState["meta"] {
  const source = isRecord(value) ? value : {}
  return {
    white: sanitizeString(source.white),
    black: sanitizeString(source.black),
    whiteElo: sanitizeElo(source.whiteElo),
    blackElo: sanitizeElo(source.blackElo),
    result: sanitizeString(source.result),
  }
}

function isScoreType(
  value: string
): value is Exclude<EngineScore, null>["type"] {
  return Object.hasOwn(SCORE_TYPES, value)
}

function sanitizeScore(value: unknown): EngineScore {
  if (!isRecord(value)) return null
  const { type, value: score } = value
  if (typeof type !== "string" || !isScoreType(type)) return null
  if (typeof score !== "number" || !Number.isFinite(score)) return null
  return { type, value: score }
}

function sanitizeDelta(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isClassification(value: string): value is MoveClassification {
  return Object.hasOwn(CLASSIFICATIONS, value)
}

function sanitizeClassification(value: unknown): MoveClassification | null {
  if (typeof value !== "string" || !isClassification(value)) return null
  return value
}

function sanitizeClock(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function sanitizeBestMove(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return typeof value === "string" ? value : undefined
}

function sanitizeOptionalScore(value: unknown): EngineScore | undefined {
  if (value === undefined) return undefined
  return sanitizeScore(value)
}

function playSan(chess: Chess, san: string): boolean {
  try {
    return chess.move(san) !== null
  } catch {
    return false
  }
}

function readMove(value: unknown, chess: Chess): MoveEntry | null {
  if (!isRecord(value) || typeof value.san !== "string" || !value.san)
    return null
  if (!playSan(chess, value.san)) return null

  return omitUndefined({
    san: value.san,
    fen: chess.fen(),
    scoreBefore: sanitizeScore(value.scoreBefore),
    scoreAfter: sanitizeScore(value.scoreAfter),
    delta: sanitizeDelta(value.delta),
    classification: sanitizeClassification(value.classification),
    clock: sanitizeClock(value.clock),
    bestMove: sanitizeBestMove(value.bestMove),
    bestScore: sanitizeOptionalScore(value.bestScore),
  } satisfies { [K in keyof Required<MoveEntry>]: MoveEntry[K] })
}

function readHistory(
  value: unknown,
  initialFen: string
): { history: MoveEntry[]; chess: Chess } | null {
  if (!Array.isArray(value)) return null
  const chess = new Chess(initialFen)
  const history: MoveEntry[] = []
  for (const entry of value) {
    const move = readMove(entry, chess)
    if (!move) return null
    history.push(move)
  }
  return { history, chess }
}

function sanitizeVariation(
  value: unknown,
  history: MoveEntry[],
  initialFen: string
): Variation | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value) || !Array.isArray(value.moves)) return null
  if (
    typeof value.branchIndex !== "number" ||
    !Number.isInteger(value.branchIndex)
  ) {
    return null
  }
  const branchIndex = value.branchIndex
  if (branchIndex < 0 || branchIndex > history.length) return null

  const chess = new Chess(initialFen)
  for (let index = 0; index < branchIndex; index++) {
    const san = history[index]?.san
    if (!san || !playSan(chess, san)) return null
  }
  const moves: MoveEntry[] = []
  for (const entry of value.moves) {
    const move = readMove(entry, chess)
    if (!move) return null
    moves.push(move)
  }
  return { branchIndex, moves }
}

function sanitizeVariationIndex(
  value: unknown,
  variation: Variation | null
): number | null {
  if (!variation || value === null || value === undefined) return null
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > variation.moves.length
  ) {
    return null
  }
  return value
}

function sanitizeMoveIndex(value: unknown, length: number): number {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= length
  ) {
    return value
  }
  return length
}

function sanitizeGame(value: unknown): GameState | null {
  if (!isRecord(value) || typeof value.initialFen !== "string") return null
  const initialFen = value.initialFen.trim()
  if (!validateFen(initialFen).ok) return null

  const replay = readHistory(value.history, initialFen)
  if (!replay) return null
  const { history, chess } = replay
  const currentMoveIndex = sanitizeMoveIndex(
    value.currentMoveIndex,
    history.length
  )
  for (let index = history.length; index > currentMoveIndex; index--) {
    chess.undo()
  }

  const variation = sanitizeVariation(value.variation, history, initialFen)

  return {
    initialFen,
    fen: chess.fen(),
    pgn: typeof value.pgn === "string" ? value.pgn : "",
    history,
    currentMoveIndex,
    turn: chess.turn(),
    isGameOver: chess.isGameOver(),
    meta: sanitizeMeta(value.meta),
    variation,
    variationIndex: sanitizeVariationIndex(value.variationIndex, variation),
  }
}

function sanitizeUIState(value: unknown): UIState {
  if (!isObject(value)) return { ...initialUIState }

  const heatmapMode = value.heatmapMode

  return {
    showHeatmap: sanitizeBoolean(value.showHeatmap, initialUIState.showHeatmap),
    heatmapMode:
      heatmapMode === "net" || heatmapMode === "split"
        ? heatmapMode
        : initialUIState.heatmapMode,
    showInfluenceTrace: sanitizeBoolean(
      value.showInfluenceTrace,
      initialUIState.showInfluenceTrace
    ),
    selectedInfluenceSquare: sanitizeSquare(value.selectedInfluenceSquare),
    showArrows: sanitizeBoolean(value.showArrows, initialUIState.showArrows),
    guessMode: sanitizeBoolean(value.guessMode, initialUIState.guessMode),
    boardFlipped: sanitizeBoolean(
      value.boardFlipped,
      initialUIState.boardFlipped
    ),
    showEvalChart: sanitizeBoolean(
      value.showEvalChart,
      initialUIState.showEvalChart
    ),
    engineEnabled: sanitizeBoolean(
      value.engineEnabled,
      initialUIState.engineEnabled
    ),
  }
}

function sanitizeEngine(value: unknown): PersistableEngineState {
  return {
    guessRevealed: isRecord(value) && value.guessRevealed === true,
  }
}

function sanitizeSavedAt(value: unknown): string {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return value
  }
  return new Date().toISOString()
}

// Scores saved before v2 use a different perspective and cannot be trusted,
// so the analysis is dropped and recomputed; the game itself is kept. From
// v2 the scores stay and only the classifications are dropped.
function dropStaleAnalysis(
  game: GameState,
  ui: UIState,
  engine: PersistableEngineState,
  keepScores = false
): PersistedSessionV3 {
  return {
    schemaVersion: 3,
    savedAt: new Date().toISOString(),
    game: {
      ...game,
      history: game.history.map((move) => ({
        ...move,
        ...(keepScores
          ? {}
          : { scoreBefore: null, scoreAfter: null, delta: null }),
        classification: null,
      })),
    },
    ui,
    engine: { guessRevealed: engine.guessRevealed === true },
  }
}

function migrateLegacySession(value: unknown): PersistedSessionV3 | null {
  if (!isRecord(value)) return null
  const game = sanitizeGame(value.game)
  if (!game) return null
  return dropStaleAnalysis(
    game,
    sanitizeUIState(value.ui),
    sanitizeEngine(value.engine)
  )
}

export function migratePersistedSession(
  value: unknown
): PersistedSession | null {
  if (!isRecord(value)) return null

  if (
    value.schemaVersion === 3 ||
    value.schemaVersion === 2 ||
    value.schemaVersion === 1
  ) {
    const game = sanitizeGame(value.game)
    if (!game) return null
    const ui = sanitizeUIState(value.ui)
    const engine = sanitizeEngine(value.engine)
    if (value.schemaVersion === 3) {
      return {
        schemaVersion: 3,
        savedAt: sanitizeSavedAt(value.savedAt),
        game,
        ui,
        engine,
      }
    }
    return dropStaleAnalysis(game, ui, engine, value.schemaVersion === 2)
  }

  if ("schemaVersion" in value) return null
  return migrateLegacySession(value)
}

function isBrowserStorageAvailable() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  )
}

export function selectPersistableEngineState(
  engineState: EngineState
): PersistableEngineState {
  return { guessRevealed: engineState.guessRevealed }
}

export function readPersistedSession(): PersistedSession | null {
  if (!isBrowserStorageAvailable()) return null

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    const migrated = migratePersistedSession(parsed)

    if (!migrated) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    // Write the repaired session back so the next refresh does not read the
    // bad value again. A game that cannot be read never reaches this branch.
    if (!sameValue(parsed, migrated)) {
      try {
        window.localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(migrated)
        )
      } catch {
        // The in-memory session is already safe. Ignore quota errors.
      }
    }

    return migrated
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function writePersistedSession(session: PersistedSessionInput): void {
  if (!isBrowserStorageAvailable()) return

  const payload: PersistedSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    ...session,
  }

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota and serialization errors.
  }
}

export function clearPersistedSession(): void {
  if (!isBrowserStorageAvailable()) return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}
