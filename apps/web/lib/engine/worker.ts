export type EngineCommand =
  | { type: "uci" }
  | { type: "isready" }
  | { type: "position"; fen: string }
  | { type: "go"; depth: number; multipv: number }
  | { type: "stop" }

export function serializeCommand(command: EngineCommand) {
  switch (command.type) {
    case "uci":
      return "uci"
    case "isready":
      return "isready"
    case "position":
      return `position fen ${command.fen}`
    case "go":
      return `go depth ${command.depth} multipv ${command.multipv}`
    case "stop":
      return "stop"
    default:
      return ""
  }
}
