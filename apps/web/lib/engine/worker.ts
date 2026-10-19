export type EngineCommand =
  | { type: "uci" }
  | { type: "isready" }
  | { type: "position"; fen: string }
  | { type: "setoption"; name: string; value: string | number }
  | { type: "go"; depth: number }
  | { type: "stop" }

export function serializeCommand(command: EngineCommand) {
  switch (command.type) {
    case "uci":
      return "uci"
    case "isready":
      return "isready"
    case "position":
      return `position fen ${command.fen}`
    case "setoption":
      return `setoption name ${command.name} value ${command.value}`
    case "go":
      return `go depth ${command.depth}`
    case "stop":
      return "stop"
    default:
      return ""
  }
}
