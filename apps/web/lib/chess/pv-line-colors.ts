// One colour per engine line, shared by the board arrows and the line list
// so each arrow can be matched to its line.
export const PV_LINE_COLORS: Record<1 | 2 | 3, string> = {
  1: "#10b981",
  2: "#60a5fa",
  3: "#f59e0b",
}

export const PV_LINE_LABEL_KEYS: Record<1 | 2 | 3, string> = {
  1: "analysis.line1",
  2: "analysis.line2",
  3: "analysis.line3",
}
