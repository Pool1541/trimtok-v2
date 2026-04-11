import { test, expect } from "@playwright/test";

// Helper: navegar hasta vista previa pasando home + downloading
async function navigateToPreview(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: /url del video/i }).pressSequentially(
    "https://www.tiktok.com/@user/video/7123456789012345678",
  );
  await page.getByRole("button", { name: /descargar/i }).click();
  await expect(page.getByRole("heading", { name: /vista previa/i })).toBeVisible({ timeout: 6000 });
}

// E2E: Flujo de recorte (Vista previa → Recortar → Confirmar → GIF)
test.describe("Flujo de recorte — T037", () => {
  test("(TE1) botón Recortar desde vista previa navega a trim", async ({ page }) => {
    await navigateToPreview(page);
    await page.getByRole("button", { name: /recortar/i }).click();
    await expect(page.getByRole("heading", { name: /recortar video/i })).toBeVisible();
  });

  test("(TE2) pantalla de recorte muestra campos INICIO y FIN", async ({ page }) => {
    await navigateToPreview(page);
    await page.getByRole("button", { name: /recortar/i }).click();
    await expect(page.getByLabel("INICIO")).toBeVisible();
    await expect(page.getByLabel("FIN")).toBeVisible();
  });

  test("(TE3) botón ← Volver regresa a vista previa", async ({ page }) => {
    await navigateToPreview(page);
    await page.getByRole("button", { name: /recortar/i }).click();
    await expect(page.getByRole("heading", { name: /recortar video/i })).toBeVisible();

    await page.getByRole("button", { name: /volver/i }).click();
    await expect(page.getByRole("heading", { name: /vista previa/i })).toBeVisible();
  });

  test("(TE4) botón GIF tiene aria-disabled=true cuando segmento > 6s (full video)", async ({ page }) => {
    await navigateToPreview(page);
    await page.getByRole("button", { name: /recortar/i }).click();
    // El video de mock es de 25s, por lo que el segmento inicial es > 6s
    const gifBtn = page.getByRole("button", { name: /crear gif/i });
    await expect(gifBtn).toHaveAttribute("aria-disabled", "true");
  });

  test("(TE5) GIF scenario: campo FIN a 5s habilita botón GIF", async ({ page }) => {
    await navigateToPreview(page);
    await page.getByRole("button", { name: /recortar/i }).click();

    // Editar el campo FIN para que el segmento sea ≤ 6s
    const finInput = page.getByLabel("FIN");
    await finInput.click({ clickCount: 3 });
    await finInput.pressSequentially("0:00:05");
    await finInput.blur();

    const gifBtn = page.getByRole("button", { name: /crear gif/i });
    await expect(gifBtn).toHaveAttribute("aria-disabled", "false");
  });

  test("(TE6) botón Recortar en trim screen dispara flujo de trim", async ({ page }) => {
    await navigateToPreview(page);
    await page.getByRole("button", { name: /recortar/i }).click();

    // Hacer clic en el botón Recortar dentro de la pantalla de trim
    await page.getByRole("button", { name: /recortar/i }).click();

    // Debe aparecer los botones de descarga post-trim en verde
    await expect(page.getByRole("button", { name: /descargar mp4/i })).toBeVisible();
  });
});
