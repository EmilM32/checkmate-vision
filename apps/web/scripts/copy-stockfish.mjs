// Copies the Stockfish WASM engine from node_modules into public/stockfish.
// File names carry the exact package version, so they can be served with an
// immutable cache header and an upgrade always changes the URL.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ENGINE_FLAVOR, engineFileName } from "../lib/engine/engine-files.mjs"

const require = createRequire(import.meta.url)
const packageJsonPath = require.resolve("stockfish/package.json")
const { version, buildVersion } = JSON.parse(
  readFileSync(packageJsonPath, "utf8")
)

const sourceDir = join(dirname(packageJsonPath), "bin")
const targetDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "stockfish"
)

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })

for (const extension of ["js", "wasm"]) {
  copyFileSync(
    join(sourceDir, `stockfish-${buildVersion}-${ENGINE_FLAVOR}.${extension}`),
    join(targetDir, engineFileName(version, extension))
  )
}

console.log(
  `Copied Stockfish ${version} (${ENGINE_FLAVOR}) to public/stockfish`
)
