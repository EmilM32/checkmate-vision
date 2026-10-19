import { expect, test, type Page } from "@playwright/test"

async function openImportInputs(page: Page) {
  await page.getByRole("button", { name: "Importuj partie" }).click()
  await expect(page.getByRole("button", { name: "Ustaw FEN" })).toBeVisible()
}

async function setFen(page: Page, fen: string) {
  const fenInput = page.locator("input.font-mono:visible").first()
  await fenInput.fill(fen)
  await page.getByRole("button", { name: "Ustaw FEN" }).click()
}

test.describe("AI-10 smoke", () => {
  test("loads app and shows core controls", async ({ page }) => {
    await page.goto("/")

    await expect(
      page.getByRole("button", { name: "Analizuj partie" })
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
    await expect(page.locator('button[title="Obroc"]:visible')).toBeVisible()
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
