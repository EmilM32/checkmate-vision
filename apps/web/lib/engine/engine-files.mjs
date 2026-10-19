// Shared by the postinstall copy script (Node) and the app, so the engine URL
// cannot drift from the copied file names.

// Single-threaded build with the small NNUE network: ~1.9 MB, and unlike the
// multi-threaded builds it needs no cross-origin isolation headers.
export const ENGINE_FLAVOR = "lite-single"

/** @param {string} version @param {"js" | "wasm"} extension */
export function engineFileName(version, extension) {
  return `stockfish-${version}-${ENGINE_FLAVOR}.${extension}`
}
