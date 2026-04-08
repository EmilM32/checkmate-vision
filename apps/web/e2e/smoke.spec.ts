import { expect, test } from "@playwright/test"

test.describe("AI-10 smoke", () => {
  test("loads app and shows core controls", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("button", { name: "Ustaw FEN" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Wczytaj PGN" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Analizuj partie" })
    ).toBeVisible()
  })

  test("accepts FEN input and keeps UI interactive", async ({ page }) => {
    await page.goto("/")

    const fenInput = page.locator("input.font-mono").first()
    await fenInput.fill(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    )
    await page.getByRole("button", { name: "Ustaw FEN" }).click()

    await expect(page.getByRole("button", { name: "Ustaw FEN" })).toBeEnabled()
    await expect(page.locator('button[title="Flip"]')).toBeVisible()
  })

  test("loads PGN and enables move navigation", async ({ page }) => {
    await page.goto("/")

    const pgnInput = page.locator(
      'textarea[placeholder="Wklej PGN..."]:visible'
    )
    await pgnInput.fill("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6")

    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    await expect(
      page.locator("ol button", { hasText: /^e4$/ }).first()
    ).toBeVisible()

    const buttons = page.locator("button")
    await expect(buttons.first()).toBeVisible()
  })
})
