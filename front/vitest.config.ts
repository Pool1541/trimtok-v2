import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.tsx"],
    exclude: ["node_modules/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        "node_modules/**",
        "src/components/ui/**",
        "tests/e2e/**",
        "*.config.*",
        "vitest-setup.ts",
      ],
    },
  },
});
