import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { TrimScreen } from "@/components/trim-screen";
import type { VideoData, TrimSelection, TrimResult } from "@/lib/app-state";

const MOCK_VIDEO: VideoData = {
  videoUrl: "/mock/sample-video.mp4",
  title: "Video de prueba",
  durationSeconds: 25,
  sourceUrl: "https://www.tiktok.com/@user/video/1",
};

const DEFAULT_SELECTION: TrimSelection = {
  startSeconds: 0,
  endSeconds: 25,
};

function renderTrimScreen(
  overrides: { trimSelection?: TrimSelection; trimResult?: TrimResult | null; videoData?: VideoData } = {},
) {
  const dispatch = vi.fn();
  const result = render(
    <TrimScreen
      videoData={overrides.videoData ?? MOCK_VIDEO}
      trimSelection={overrides.trimSelection ?? DEFAULT_SELECTION}
      trimResult={overrides.trimResult ?? null}
      dispatch={dispatch}
    />,
  );
  return { dispatch, ...result };
}

describe("TrimScreen — User Story 4", () => {
  it("muestra los campos INICIO y FIN con valores iniciales", () => {
    renderTrimScreen({ trimSelection: { startSeconds: 5, endSeconds: 20 } });
    expect(screen.getByLabelText("INICIO")).toHaveValue("0:00:05");
    expect(screen.getByLabelText("FIN")).toHaveValue("0:00:20");
  });

  it("botón '← Volver' dispara BACK_TO_PREVIEW", async () => {
    const { dispatch } = renderTrimScreen();
    await userEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "BACK_TO_PREVIEW" });
  });

  it("botón 'Recortar' dispara CONFIRM_TRIM con mode video", async () => {
    const { dispatch } = renderTrimScreen();
    await userEvent.click(screen.getByRole("button", { name: /recortar/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "CONFIRM_TRIM", mode: "video" });
  });

  it("botón GIF tiene aria-disabled=true cuando segmento > 6s", () => {
    renderTrimScreen({ trimSelection: { startSeconds: 0, endSeconds: 25 } });
    const gifBtn = screen.getByRole("button", { name: /crear gif/i });
    expect(gifBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("botón GIF NO tiene aria-disabled cuando segmento ≤ 6s", () => {
    renderTrimScreen({ trimSelection: { startSeconds: 0, endSeconds: 5 } });
    const gifBtn = screen.getByRole("button", { name: /crear gif/i });
    expect(gifBtn).toHaveAttribute("aria-disabled", "false");
  });

  it("campo INICIO muestra error con valor inválido en blur", () => {
    renderTrimScreen({ trimSelection: { startSeconds: 5, endSeconds: 20 } });
    const startInput = screen.getByLabelText("INICIO");
    fireEvent.change(startInput, { target: { value: "invalid" } });
    fireEvent.blur(startInput);
    expect(startInput).toHaveAttribute("aria-invalid", "true");
  });

  it("accesibilidad — sin violaciones axe", async () => {
    const { container } = renderTrimScreen({ trimSelection: { startSeconds: 0, endSeconds: 5 } });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
