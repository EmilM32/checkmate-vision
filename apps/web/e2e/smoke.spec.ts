import { expect, test, type Page } from "@playwright/test"

// The import section starts open while no game is loaded.
async function openImportInputs(page: Page) {
  const toggle = page.getByRole("button", { name: "Importuj partię" })
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click()
  }
  await expect(page.getByRole("button", { name: "Ustaw FEN" })).toBeVisible()
}

async function setFen(page: Page, fen: string) {
  const fenInput = page.locator("input.font-mono:visible").first()
  await fenInput.fill(fen)
  await page.getByRole("button", { name: "Ustaw FEN" }).click()
}

async function dragPiece(
  page: Page,
  fromSquare: string,
  toSquare: string,
  piece: string
) {
  const square = page.locator(`[data-square="${fromSquare}"]`)
  const pieceLocator = square.locator(`[data-piece="${piece}"]`)
  const handle = square.locator('[aria-roledescription="draggable"]')

  await expect(handle).toHaveAttribute("aria-disabled", "false")
  await expect
    .poll(async () => {
      const pieceBox = await pieceLocator.boundingBox()
      const squareBox = await square.boundingBox()
      if (!pieceBox || !squareBox || squareBox.width < 8) return false
      const transform = await pieceLocator.evaluate(
        (el) => getComputedStyle(el).transform
      )
      if (transform !== "none") return false
      const cx = pieceBox.x + pieceBox.width / 2
      const cy = pieceBox.y + pieceBox.height / 2
      return (
        cx >= squareBox.x &&
        cx < squareBox.x + squareBox.width &&
        cy >= squareBox.y &&
        cy < squareBox.y + squareBox.height
      )
    })
    .toBe(true)

  const fromBox = (await handle.boundingBox())!
  const toBox = (await page
    .locator(`[data-square="${toSquare}"]`)
    .boundingBox())!
  const startX = fromBox.x + fromBox.width / 2
  const startY = fromBox.y + fromBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY - fromBox.height / 3)
  await expect(handle).toHaveAttribute("aria-pressed", "true")
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const marker = document.createElement("button")
        marker.type = "button"
        let saw = false
        marker.addEventListener("click", () => {
          saw = true
        })
        document.body.appendChild(marker)
        marker.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        )
        marker.remove()
        return saw
      })
    )
    .toBe(true)
}

test.describe("AI-10 smoke", () => {
  test("loads app and shows core controls", async ({ page }) => {
    await page.goto("/")

    await expect(
      page.getByRole("button", { name: "Analizuj partię" })
    ).toBeVisible()

    await openImportInputs(page)
    await expect(
      page.getByRole("button", { name: "Wczytaj PGN" })
    ).toBeVisible()
  })

  test("accepts FEN input and keeps UI interactive", async ({ page }) => {
    await page.goto("/")
    await openImportInputs(page)

    await setFen(
      page,
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    )

    await expect(page.getByRole("button", { name: "Ustaw FEN" })).toBeEnabled()
    await expect(page.getByRole("button", { name: "Obróć" })).toBeVisible()
  })

  test("rejects a FEN where the side not to move is in check", async ({
    page,
  }) => {
    await page.goto("/")
    await openImportInputs(page)

    const whitePawn = page.locator(
      '[data-square="e2"] [data-piece="wP"]:visible'
    )
    await expect(whitePawn).toBeVisible()

    const impossible = "4k3/4R3/8/8/8/8/8/4K3 w - - 0 1"
    await setFen(page, impossible)

    const field = page.locator("input.font-mono:visible").first()
    await expect(field).toHaveAttribute("aria-invalid", "true")
    const describedBy = await field.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const alert = page.locator(`[id="${describedBy}"]`)
    await expect(alert).toHaveRole("alert")
    await expect(alert).toHaveText(
      "Ta pozycja jest niemożliwa: król strony, która nie ma ruchu, jest w szachu."
    )
    await expect(field).toHaveValue(impossible)
    await expect(whitePawn).toBeVisible()
    await expect(
      page.locator('[data-square="e7"] [data-piece="wR"]:visible')
    ).toHaveCount(0)

    await setFen(page, "4k3/8/8/8/8/8/8/4K3 w - - 0 1")
    await expect(field).not.toHaveAttribute("aria-invalid")
    await expect(page.locator("p[role=alert]")).toHaveCount(0)
    await expect(whitePawn).toHaveCount(0)
    await expect(
      page.locator('[data-square="e1"] [data-piece="wK"]:visible')
    ).toBeVisible()
  })

  test("loads PGN and enables move navigation", async ({ page }) => {
    await page.goto("/")
    await openImportInputs(page)

    const pgnInput = page.locator(
      'textarea[placeholder="Wklej PGN..."]:visible'
    )
    await pgnInput.fill("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6")

    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    await expect(
      page.locator("ol:visible button", { hasText: /^e4$/ }).first()
    ).toBeVisible()

    const buttons = page.locator("button:visible")
    await expect(buttons.first()).toBeVisible()
  })
})

test.describe("engine analysis", () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Silnik", exact: true }).click()
    await openImportInputs(page)
  })

  test("rejects a set-up PGN that starts from an impossible position", async ({
    page,
  }) => {
    const field = page.locator('textarea[placeholder="Wklej PGN..."]:visible')
    await field.fill("1. e4 e5")
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    const blackReply = page.locator("ol:visible button", { hasText: /^e5$/ })
    await expect(blackReply.first()).toBeVisible()
    const playedPawn = page.locator(
      '[data-square="e4"] [data-piece="wP"]:visible'
    )
    await expect(playedPawn).toBeVisible()
    const score = page.locator("[data-testid=pv-score]:visible").first()
    await expect(score).toBeVisible({ timeout: 30_000 })

    // Loading a game closes the import section.
    await openImportInputs(page)

    // Headers alone, and the same headers plus a move. On main the game with a
    // move loads, and Home then sends the illegal start to Stockfish.
    const headers = [
      '[SetUp "1"]',
      '[FEN "4k3/4R3/8/8/8/8/8/4K3 w - - 0 1"]',
    ].join("\n")
    for (const impossible of [headers, `${headers}\n\n1. Ke2 *`]) {
      await field.fill(impossible)
      await page.getByRole("button", { name: "Wczytaj PGN" }).click()

      await expect(field).toHaveAttribute("aria-invalid", "true")
      const describedBy = await field.getAttribute("aria-describedby")
      expect(describedBy).toBeTruthy()
      const alert = page.locator(`[id="${describedBy}"]`)
      await expect(alert).toHaveRole("alert")
      await expect(alert).toHaveText(
        "Partia zaczyna się od niemożliwej pozycji: król strony, która nie ma ruchu, jest w szachu."
      )

      await expect(blackReply.first()).toBeVisible()
      await expect(playedPawn).toBeVisible()
      await expect(
        page.locator('[data-square="e7"] [data-piece="wR"]:visible')
      ).toHaveCount(0)
      await expect(
        page.getByText("Silnik niespodziewanie przestał działać.")
      ).toHaveCount(0)
      await expect(score).toBeVisible()
    }

    // Home walks back through the game that stayed. The engine keeps scoring it.
    await page.getByRole("heading", { name: "CheckMate Vision" }).click()
    await page.keyboard.press("Home")
    await expect(
      page.locator('[data-square="e2"] [data-piece="wP"]:visible')
    ).toBeVisible()
    await expect(
      page.locator('[data-square="e7"] [data-piece="wR"]:visible')
    ).toHaveCount(0)
    await expect(
      page.getByText("Silnik niespodziewanie przestał działać.")
    ).toHaveCount(0)
    await expect(score).toBeVisible({ timeout: 30_000 })
  })

  test("reports evaluation from white's perspective with black to move", async ({
    page,
  }) => {
    // White is a queen up; black is to move.
    await setFen(page, "4k3/8/8/8/8/8/8/3QK3 b - - 0 1")

    await expect(
      page.locator("[data-testid=pv-score]:visible").first()
    ).toHaveText(/^(\+|M\+)/, {
      timeout: 30_000,
    })
  })

  test("analyses a game while the live engine keeps running", async ({
    page,
  }) => {
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#")
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    await page.getByRole("button", { name: "Analizuj partię" }).click()

    // Browsing does not cancel game analysis, and the live engine analyses
    // the browsed position meanwhile.
    await page.keyboard.press("Home")
    await expect(
      page.locator("[data-testid=pv-score]:visible").first()
    ).toBeVisible({ timeout: 30_000 })

    await expect(
      page.locator("span:visible", { hasText: /^Analiza partii zakończona$/ })
    ).toBeVisible({ timeout: 45_000 })
    await expect
      .poll(() =>
        page.evaluate(() => {
          const session = localStorage.getItem("checkmate-vision:session")
          return session
            ? JSON.parse(session).game.history.map(
                (move: { classification: string | null }) => move.classification
              )
            : []
        })
      )
      .toEqual(expect.arrayContaining(["blunder"]))

    // Black's 3...Nf6?? allowed mate: White plays clearly better.
    const accuracy = async (side: string) =>
      Number(
        await page
          .locator(`[data-testid=accuracy-${side}]:visible`)
          .textContent()
      )
    await expect(
      page.locator("[data-testid=game-summary]:visible")
    ).toBeVisible()
    expect(await accuracy("white")).toBeGreaterThan(await accuracy("black"))

    // Shift + → jumps from the start to the first error (?!, ? or ??).
    await page.keyboard.press("Home")
    await page.keyboard.press("Shift+ArrowRight")
    await expect(
      page.locator('ol:visible button[aria-current="step"]')
    ).toContainText("?")

    // Guess mode hides the answers, the summary included.
    await page.getByRole("button", { name: "Zgaduj", exact: true }).click()
    await expect(
      page.locator("[data-testid=game-summary]:visible")
    ).toHaveCount(0)
  })

  test("keeps analysing after a checkmate position", async ({ page }) => {
    await setFen(
      page,
      "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4"
    )
    await expect(page.getByTestId("eval-label")).toHaveText("#", {
      timeout: 30_000,
    })

    await setFen(page, "4k3/8/8/8/8/8/8/3QK3 w - - 0 1")
    await expect(
      page.locator("[data-testid=pv-score]:visible").first()
    ).toBeVisible({
      timeout: 30_000,
    })
  })
})

test.describe("game import and moves", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await openImportInputs(page)
  })

  test("loads a PGN set up from FEN with player headers", async ({ page }) => {
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill(
        [
          '[White "Alice"]',
          '[Black "Bob"]',
          '[WhiteElo "2100"]',
          '[Result "1/2-1/2"]',
          '[SetUp "1"]',
          '[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"]',
          "",
          "40... Kd7 { [%clk 0:01:30] } 41. e4 { [%clk 0:02:05] } Ke6 1/2-1/2",
        ].join("\n")
      )
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()

    await expect(page.getByText("Alice", { exact: true })).toBeVisible()
    await expect(page.getByText("Bob", { exact: true })).toBeVisible()
    await expect(page.getByText("(2100)")).toBeVisible()
    await expect(page.getByText("1:30")).toBeVisible()

    const moveList = page.locator("ol:visible").first()
    await expect(moveList.locator("li").first()).toHaveText(/^40\.…Kd7$/)
    await expect(moveList.locator("li").nth(1)).toHaveText(/^41\.e4Ke6$/)
    await expect(
      page.locator("p:visible", { hasText: /^1\/2-1\/2$/ })
    ).toBeVisible()
  })

  test("lets the player choose the promotion piece", async ({ page }) => {
    await setFen(page, "8/4P1k1/8/8/8/8/8/4K3 w - - 0 1")
    await dragPiece(page, "e7", "e8", "wP")

    const picker = page.getByRole("dialog", { name: "Wybierz figurę promocji" })
    await expect(picker).toBeVisible()
    await picker.getByRole("button", { name: "Skoczek" }).click()

    await expect(picker).toBeHidden()
    await expect(
      page.locator("ol:visible button", { hasText: "e8=N+" }).first()
    ).toBeVisible()
  })
})

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("scrolls to the whole analysis panel without overflowing sideways", async ({
    page,
  }) => {
    await page.goto("/")

    // The board stays within the first screen.
    const board = page.locator("main section").first()
    const boardBox = await board.boundingBox()
    expect(boardBox).not.toBeNull()
    expect(boardBox!.y + boardBox!.height).toBeLessThanOrEqual(844)

    // The panel's last control used to be clipped below the viewport.
    await openImportInputs(page)
    const loadPgn = page.getByRole("button", { name: "Wczytaj PGN" })
    await loadPgn.scrollIntoViewIfNeeded()
    await expect(loadPgn).toBeInViewport()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe("wide layout", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("keeps the board size when the evaluation chart opens", async ({
    page,
  }) => {
    await page.goto("/")
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill("1. e4 e5 2. Nf3 Nc6")
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()

    // Moves are listed in the game panel left of the board.
    await expect(page.getByText("Partia", { exact: true })).toBeVisible()
    await expect(
      page.locator("ol:visible button", { hasText: /^Nc6$/ })
    ).toHaveCount(1)

    const board = page.locator("main section").first()
    const before = (await board.boundingBox())!.width
    await page.getByRole("button", { name: "Wykres", exact: true }).click()
    await expect(page.locator(".recharts-surface:visible")).toBeVisible()
    expect((await board.boundingBox())!.width).toBe(before)
  })
})

test.describe("session persistence", () => {
  test("keeps the loaded game and the current move after a refresh", async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message)
    })

    await page.goto("/")
    await openImportInputs(page)
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill("1. e4 e5 2. Nf3 Nc6")
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    await expect(
      page.locator("ol:visible button", { hasText: /^Nc6$/ })
    ).toBeVisible()

    // Leave the game one move before the end, so a restored position is
    // distinct from both the start and the final move.
    await page.keyboard.press("ArrowLeft")
    await expect(
      page.locator('ol:visible button[aria-current="step"]')
    ).toHaveText(/Nf3/)

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("checkmate-vision:session")
          if (!raw) return null
          const session = JSON.parse(raw)
          const index = session.game.currentMoveIndex
          return session.game.history[index - 1]?.san ?? null
        })
      )
      .toBe("Nf3")

    await page.reload()
    await expect(
      page.locator('ol:visible button[aria-current="step"]')
    ).toHaveText(/Nf3/)
    await expect(
      page.locator("ol:visible button", { hasText: /^e4$/ })
    ).toBeVisible()
    await expect(
      page.locator("ol:visible button", { hasText: /^Nc6$/ })
    ).toBeVisible()

    const errorsBeforeClick = consoleErrors.length
    await page.getByRole("button", { name: "Heatmapa", exact: true }).click()
    await page.locator('[data-square="e4"]').click({
      button: "right",
      modifiers: ["Alt"],
    })
    await expect(page.getByTestId("influence-summary")).toContainText("e4")
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(undefined))
          )
        })
    )

    expect(consoleErrors.slice(errorsBeforeClick)).toEqual([])
  })
})

test.describe("variations", () => {
  test("a move mid-game starts a variation and keeps the game", async ({
    page,
  }) => {
    await page.goto("/")
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6")
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()

    // Back to the position after 1... e5 and play 2. d4 instead of Nf3.
    await page.keyboard.press("Home")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowRight")
    await dragPiece(page, "d2", "d4", "wP")

    const variation = page.locator("[data-testid=variation]:visible")
    await expect(variation).toContainText("d4")
    // The game's own moves are all still there.
    await expect(
      page.locator("ol:visible button", { hasText: /^a6$/ })
    ).toHaveCount(1)

    await variation.getByRole("button", { name: "Wróć do partii" }).click()
    await expect(
      page.locator('ol:visible button[aria-current="step"]')
    ).toHaveText(/e5/)

    await variation.getByRole("button", { name: "Usuń wariant" }).click()
    await expect(variation).toHaveCount(0)
  })

  test("judges your own move in a variation with the engine on", async ({
    page,
  }) => {
    await page.goto("/")
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill("1. e4 e5 2. Nf3 Nc6")
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    await page.getByRole("button", { name: "Silnik", exact: true }).click()

    // After 1. e4 e5 play 2. Qh5 instead of the game's Nf3.
    await page.keyboard.press("Home")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowRight")
    await expect(
      page.locator("[data-testid=pv-score]:visible").first()
    ).toBeVisible({ timeout: 30_000 })
    await dragPiece(page, "d1", "h5", "wQ")

    const card = page.locator("[data-testid=move-card]:visible")
    await expect(card).toContainText("Qh5", { timeout: 40_000 })
    await expect(card).toContainText("Wybór silnika")
  })
})
