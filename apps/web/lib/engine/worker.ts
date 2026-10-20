export type EngineCommand =
  | { type: "uci" }
  | { type: "isready" }
  | { type: "position"; fen: string }
  | { type: "setoption"; name: string; value: string | number }
  | { type: "ucinewgame" }
  | { type: "go"; depth: number; movetimeMs?: number; nodes?: number }
  | { type: "stop" }

export function serializeCommand(command: EngineCommand) {
  switch (command.type) {
    case "uci":
      return "uci"
    case "isready":
      return "isready"
    case "ucinewgame":
      return "ucinewgame"
    case "position":
      return `position fen ${command.fen}`
    case "setoption":
      return `setoption name ${command.name} value ${command.value}`
    case "go":
      // With several limits the engine stops at whichever is reached first.
      return [
        `go depth ${command.depth}`,
        command.nodes === undefined ? "" : ` nodes ${command.nodes}`,
        command.movetimeMs === undefined
          ? ""
          : ` movetime ${command.movetimeMs}`,
      ].join("")
    case "stop":
      return "stop"
    default:
      return ""
  }
}
