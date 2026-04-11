import { describe, it, expect } from "vitest";
import { appReducer, initialState } from "@/lib/app-state";
import { MOCK_VIDEO_DATA } from "@/lib/mock-data";

const mockVideoData = MOCK_VIDEO_DATA;

describe("appReducer", () => {
  it("estado inicial es { screen: 'home' }", () => {
    expect(initialState).toEqual({ screen: "home" });
  });

  it("START_DOWNLOAD transiciona a 'downloading' con url", () => {
    const url = "https://www.tiktok.com/@user/video/7123456789012345678";
    const next = appReducer(initialState, { type: "START_DOWNLOAD", url });
    expect(next).toEqual({ screen: "downloading", url });
  });

  it("DOWNLOAD_COMPLETE desde 'downloading' transiciona a 'preview' con videoData", () => {
    const downloading = appReducer(initialState, {
      type: "START_DOWNLOAD",
      url: "https://www.tiktok.com/@user/video/7123456789012345678",
    });
    const next = appReducer(downloading, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    expect(next).toEqual({ screen: "preview", videoData: mockVideoData });
  });

  it("DOWNLOAD_COMPLETE se ignora si no está en 'downloading'", () => {
    const result = appReducer(initialState, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    expect(result).toEqual(initialState);
  });

  it("RESET desde cualquier estado vuelve a 'home'", () => {
    const downloading = appReducer(initialState, {
      type: "START_DOWNLOAD",
      url: "https://www.tiktok.com/@user/video/7123456789012345678",
    });
    expect(appReducer(downloading, { type: "RESET" })).toEqual({
      screen: "home",
    });
    const preview = appReducer(downloading, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    expect(appReducer(preview, { type: "RESET" })).toEqual({ screen: "home" });
  });

  it("OPEN_TRIM desde 'preview' transiciona a 'trim' con trimSelection inicial [0, durationSeconds]", () => {
    const downloading = appReducer(initialState, {
      type: "START_DOWNLOAD",
      url: "https://www.tiktok.com/@user/video/7123456789012345678",
    });
    const preview = appReducer(downloading, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    const trim = appReducer(preview, { type: "OPEN_TRIM" });
    expect(trim).toEqual({
      screen: "trim",
      videoData: mockVideoData,
      trimSelection: {
        startSeconds: 0,
        endSeconds: mockVideoData.durationSeconds,
      },
      trimResult: null,
    });
  });

  it("OPEN_TRIM se ignora si no está en 'preview'", () => {
    const result = appReducer(initialState, { type: "OPEN_TRIM" });
    expect(result).toEqual(initialState);
  });

  it("BACK_TO_PREVIEW desde 'trim' retorna a 'preview'", () => {
    const downloading = appReducer(initialState, {
      type: "START_DOWNLOAD",
      url: "https://www.tiktok.com/@user/video/7123456789012345678",
    });
    const preview = appReducer(downloading, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    const trim = appReducer(preview, { type: "OPEN_TRIM" });
    const back = appReducer(trim, { type: "BACK_TO_PREVIEW" });
    expect(back).toEqual({ screen: "preview", videoData: mockVideoData });
  });

  it("UPDATE_TRIM_SELECTION actualiza trimSelection y pone trimResult en null", () => {
    const downloading = appReducer(initialState, {
      type: "START_DOWNLOAD",
      url: "https://www.tiktok.com/@user/video/7123456789012345678",
    });
    const preview = appReducer(downloading, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    const trim = appReducer(preview, { type: "OPEN_TRIM" });
    // Primero confirmar
    const confirmed = appReducer(trim, {
      type: "CONFIRM_TRIM",
      mode: "video",
    });
    expect(confirmed.screen === "trim" && (confirmed as any).trimResult).not.toBeNull();
    // Luego actualizar selección
    const updated = appReducer(confirmed, {
      type: "UPDATE_TRIM_SELECTION",
      selection: { startSeconds: 2, endSeconds: 10 },
    });
    expect(updated.screen).toBe("trim");
    if (updated.screen === "trim") {
      expect(updated.trimResult).toBeNull();
      expect(updated.trimSelection).toEqual({
        startSeconds: 2,
        endSeconds: 10,
      });
    }
  });

  it("CONFIRM_TRIM crea trimResult con la selección y modo", () => {
    const downloading = appReducer(initialState, {
      type: "START_DOWNLOAD",
      url: "https://www.tiktok.com/@user/video/7123456789012345678",
    });
    const preview = appReducer(downloading, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    const trim = appReducer(preview, { type: "OPEN_TRIM" });
    const confirmed = appReducer(trim, {
      type: "CONFIRM_TRIM",
      mode: "video",
    });
    expect(confirmed.screen).toBe("trim");
    if (confirmed.screen === "trim") {
      expect(confirmed.trimResult).not.toBeNull();
      expect(confirmed.trimResult?.mode).toBe("video");
      expect(confirmed.trimResult?.selection).toEqual({
        startSeconds: 0,
        endSeconds: mockVideoData.durationSeconds,
      });
    }
  });

  it("CONFIRM_TRIM mode gif crea trimResult con mode gif", () => {
    const downloading = appReducer(initialState, {
      type: "START_DOWNLOAD",
      url: "https://www.tiktok.com/@user/video/7123456789012345678",
    });
    const preview = appReducer(downloading, {
      type: "DOWNLOAD_COMPLETE",
      videoData: mockVideoData,
    });
    let trim = appReducer(preview, { type: "OPEN_TRIM" });
    trim = appReducer(trim, {
      type: "UPDATE_TRIM_SELECTION",
      selection: { startSeconds: 0, endSeconds: 4 },
    });
    const confirmed = appReducer(trim, { type: "CONFIRM_TRIM", mode: "gif" });
    expect(confirmed.screen === "trim" && (confirmed as any).trimResult?.mode).toBe("gif");
  });
});
