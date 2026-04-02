export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "good"
  | "mistake"
  | "blunder"

export type ClassificationInput = {
  scoreBefore: number
  scoreAfter: number
  playedBy: "white" | "black"
}

export function classifyMove(input: ClassificationInput): MoveClassification {
  void input
  // TODO: implement thresholds and edge cases from design vision.
  return "good"
}
