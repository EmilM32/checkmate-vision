import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  {
    // Vendored Stockfish build copied in by the postinstall script.
    ignores: ["public/**"],
  },
  ...nextJsConfig,
]
