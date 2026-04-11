import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { HomeScreen } from "@/components/home-screen";

// Mock dispatch
function renderHomeScreen() {
  const dispatch = vi.fn();
  const result = render(<HomeScreen dispatch={dispatch} />);
  return { dispatch, ...result };
}

describe("HomeScreen — User Story 1", () => {
  it("(AC1) submit vacío muestra error 'Pega un enlace de TikTok'", async () => {
    const { dispatch } = renderHomeScreen();
    const btn = screen.getByRole("button", { name: /descargar/i });
    await userEvent.click(btn);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pega un enlace de TikTok",
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("(AC2) URL de youtube muestra error de dominio", async () => {
    const { dispatch } = renderHomeScreen();
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "https://youtube.com/watch?v=abc");
    await userEvent.click(screen.getByRole("button", { name: /descargar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El enlace no apunta a un video de TikTok",
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("(AC3) URL TikTok válida dispara dispatch START_DOWNLOAD", async () => {
    const { dispatch } = renderHomeScreen();
    const input = screen.getByRole("textbox");
    const validUrl =
      "https://www.tiktok.com/@user/video/7123456789012345678";
    await userEvent.type(input, validUrl);
    await userEvent.click(screen.getByRole("button", { name: /descargar/i }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "START_DOWNLOAD",
      url: validUrl,
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("(AC4) corrección de URL tras error permite envío exitoso", async () => {
    const { dispatch } = renderHomeScreen();
    const input = screen.getByRole("textbox");

    // Primero error
    await userEvent.type(input, "bad-url");
    await userEvent.click(screen.getByRole("button", { name: /descargar/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Luego corregir y reenviar
    await userEvent.clear(input);
    await userEvent.type(
      input,
      "https://www.tiktok.com/@user/video/7123456789012345678",
    );
    await userEvent.click(screen.getByRole("button", { name: /descargar/i }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "START_DOWNLOAD" }),
    );
  });

  it("input tiene aria-invalid=true cuando hay error", async () => {
    renderHomeScreen();
    await userEvent.click(screen.getByRole("button", { name: /descargar/i }));
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("accesibilidad — sin violaciones axe", async () => {
    const { container } = renderHomeScreen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
