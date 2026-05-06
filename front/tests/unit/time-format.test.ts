import { describe, it, expect } from "vitest";
import { formatHHMMSS, parseHHMMSS, GIF_MAX_DURATION_SECONDS } from "@/lib/time-format";

describe("formatHHMMSS", () => {
  it("formatea 0 como 0:00:00", () => {
    expect(formatHHMMSS(0)).toBe("0:00:00");
  });

  it("formatea 65 como 0:01:05", () => {
    expect(formatHHMMSS(65)).toBe("0:01:05");
  });

  it("formatea 3661 como 1:01:01", () => {
    expect(formatHHMMSS(3661)).toBe("1:01:01");
  });

  it("formatea 59 como 0:00:59", () => {
    expect(formatHHMMSS(59)).toBe("0:00:59");
  });

  it("muestra decimal cuando hay fracción de segundo", () => {
    expect(formatHHMMSS(1.5)).toBe("0:00:01.5");
  });

  it("muestra decimal en minutos con fracción de segundo", () => {
    expect(formatHHMMSS(65.5)).toBe("0:01:05.5");
  });

  it("no muestra decimal cuando la fracción es 0", () => {
    expect(formatHHMMSS(1.0)).toBe("0:00:01");
  });

  it("redondea la fracción a 1 decimal", () => {
    expect(formatHHMMSS(3.7)).toBe("0:00:03.7");
  });
});

describe("parseHHMMSS", () => {
  it("parsea '0:01:05' → 65", () => {
    expect(parseHHMMSS("0:01:05")).toBe(65);
  });

  it("parsea '1:00:00' → 3600", () => {
    expect(parseHHMMSS("1:00:00")).toBe(3600);
  });

  it("retorna null para formato inválido", () => {
    expect(parseHHMMSS("abc")).toBeNull();
    expect(parseHHMMSS("1:2:3")).toBeNull();
  });

  it("retorna null cuando minutos ≥ 60", () => {
    expect(parseHHMMSS("0:60:00")).toBeNull();
  });

  it("retorna null cuando segundos ≥ 60", () => {
    expect(parseHHMMSS("0:00:60")).toBeNull();
  });

  it("parsea '0:00:01.5' → 1.5", () => {
    expect(parseHHMMSS("0:00:01.5")).toBe(1.5);
  });

  it("parsea '0:00:03.7' → 3.7", () => {
    expect(parseHHMMSS("0:00:03.7")).toBe(3.7);
  });

  it("parsea '0:01:05.5' → 65.5", () => {
    expect(parseHHMMSS("0:01:05.5")).toBe(65.5);
  });

  it("retorna null para más de 1 decimal", () => {
    expect(parseHHMMSS("0:00:01.55")).toBeNull();
  });
});

describe("GIF_MAX_DURATION_SECONDS", () => {
  it("es 6", () => {
    expect(GIF_MAX_DURATION_SECONDS).toBe(6);
  });
});
