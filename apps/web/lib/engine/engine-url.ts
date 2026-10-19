import stockfishPackage from "stockfish/package.json"

import { engineFileName } from "@/lib/engine/engine-files.mjs"

export const ENGINE_URL = `/stockfish/${engineFileName(stockfishPackage.version, "js")}`
