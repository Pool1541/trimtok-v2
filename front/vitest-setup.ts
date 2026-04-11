import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as axeMatchers from "vitest-axe/matchers";

// Polyfill ResizeObserver para Radix UI (jsdom no lo incluye)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(cleanup);
expect.extend(axeMatchers);
