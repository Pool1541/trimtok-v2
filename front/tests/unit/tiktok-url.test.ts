import { describe, it, expect } from "vitest";
import { getUrlError, isTikTokVideoUrl } from "@/lib/tiktok-url";

describe("getUrlError", () => {
  it("retorna mensaje de campo vacío cuando url es vacía", () => {
    expect(getUrlError("")).toBe("Pega un enlace de TikTok");
  });

  it("retorna mensaje de campo vacío cuando url es solo espacios", () => {
    expect(getUrlError("   ")).toBe("Pega un enlace de TikTok");
  });

  it("retorna mensaje no-video para URL de youtube", () => {
    expect(getUrlError("https://youtube.com/watch?v=abc")).toBe(
      "El enlace no apunta a un video de TikTok",
    );
  });

  it("retorna mensaje no-video para tiktok.com/explore", () => {
    expect(getUrlError("https://www.tiktok.com/explore")).toBe(
      "El enlace no apunta a un video de TikTok",
    );
  });

  it("retorna mensaje no-video para perfil tiktok sin /video/", () => {
    expect(getUrlError("https://www.tiktok.com/@user")).toBe(
      "El enlace no apunta a un video de TikTok",
    );
  });

  it("retorna null para URL de video tiktok estándar", () => {
    expect(
      getUrlError("https://www.tiktok.com/@user/video/7123456789012345678"),
    ).toBeNull();
  });

  it("retorna null para URL de video tiktok sin www", () => {
    expect(
      getUrlError("https://tiktok.com/@user.name/video/1234567890"),
    ).toBeNull();
  });

  it("retorna null para vm.tiktok.com/ABC123", () => {
    expect(getUrlError("https://vm.tiktok.com/ZMeXXXXX/")).toBeNull();
  });

  it("retorna null para vt.tiktok.com/XYZ", () => {
    expect(getUrlError("https://vt.tiktok.com/ZMeYYYYY/")).toBeNull();
  });

  it("retorna null para URL con query params", () => {
    expect(
      getUrlError(
        "https://www.tiktok.com/@user/video/7123456789012345678?is_from_webapp=1",
      ),
    ).toBeNull();
  });
});

describe("isTikTokVideoUrl", () => {
  it("retorna false para URL vacía", () => {
    expect(isTikTokVideoUrl("")).toBe(false);
  });

  it("retorna true para URL estándar", () => {
    expect(
      isTikTokVideoUrl(
        "https://www.tiktok.com/@user/video/7123456789012345678",
      ),
    ).toBe(true);
  });

  it("retorna false para URL de TikTok sin /video/", () => {
    expect(isTikTokVideoUrl("https://www.tiktok.com")).toBe(false);
  });
});
