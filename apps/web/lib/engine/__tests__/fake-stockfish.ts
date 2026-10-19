import type { EngineWorker } from "@/lib/engine/uci-engine"

/** A scriptable stand-in for the Stockfish worker used in tests. */
export class FakeStockfish implements EngineWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  commands: string[] = []
  terminated = false

  postMessage(command: string) {
    this.commands.push(command)
  }

  terminate() {
    this.terminated = true
  }

  emit(line: string) {
    this.onmessage?.(new MessageEvent("message", { data: line }))
  }

  crash(message: string) {
    this.onerror?.(new ErrorEvent("error", { message }))
  }

  /** Answers the UCI handshake the way Stockfish does. */
  completeHandshake() {
    this.emit("uciok")
    this.emit("readyok")
  }

  /** The FEN of the last "position" command. */
  get lastPosition() {
    const command = [...this.commands]
      .reverse()
      .find((c) => c.startsWith("position fen "))
    return command?.slice("position fen ".length) ?? null
  }
}
