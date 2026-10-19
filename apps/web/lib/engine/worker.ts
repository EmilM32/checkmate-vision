export type EngineCommand =
  | { type: "uci" }
  | { type: "isready" }
  | { type: "position"; fen: string }
  | { type: "setoption"; name: string; value: string | number }
  | { type: "go"; depth: number; movetimeMs?: number }
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
      // With both limits the engine stops at whichever is reached first.
      return command.movetimeMs === undefined
        ? `go depth ${command.depth}`
        : `go depth ${command.depth} movetime ${command.movetimeMs}`
    case "stop":
      return "stop"
    default:
      return ""
  }
}
