export type HeatmapCell = {
  square: string
  intensity: number
  side: "white" | "black" | "neutral"
}

export function buildHeatmap(fen: string): HeatmapCell[] {
  void fen
  // TODO: compute board control heatmap from chess.js attacks.
  return []
}
