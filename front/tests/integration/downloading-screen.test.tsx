import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { DownloadingScreen } from "@/components/downloading-screen";
import { MOCK_VIDEO_DATA } from "@/lib/mock-data";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderDownloadingScreen() {
  const dispatch = vi.fn();
  const result = render(
    <DownloadingScreen url="https://www.tiktok.com/@user/video/1" dispatch={dispatch} />,
  );
  return { dispatch, ...result };
}

describe("DownloadingScreen — User Story 2", () => {
  it("(AC1) muestra barra de progreso con role=progressbar", () => {
    renderDownloadingScreen();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
  });

  it("(AC2) muestra texto 'Descargando...'", () => {
    renderDownloadingScreen();
    expect(screen.getByText("Descargando...")).toBeInTheDocument();
  });

  it("(AC3) dispatch DOWNLOAD_COMPLETE con MOCK_VIDEO_DATA tras 2500ms", async () => {
    const { dispatch } = renderDownloadingScreen();
    expect(dispatch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "DOWNLOAD_COMPLETE",
      videoData: MOCK_VIDEO_DATA,
    });
  });

  it("(AC4) dispatch NO se llama antes de los 2500ms", async () => {
    const { dispatch } = renderDownloadingScreen();

    await act(async () => {
      vi.advanceTimersByTime(2499);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("accesibilidad — sin violaciones axe", async () => {
    vi.useRealTimers();
    const { container } = renderDownloadingScreen();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
