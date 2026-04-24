import type { NextConfig } from "next";

// En GitHub Pages (proyecto), los assets se sirven bajo /<repo-name>/.
// Con dominio personalizado (Cloudflare) o en dev, basePath es vacío.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // assetPrefix garantiza que _next/static/* se cargue desde la sub-ruta correcta
  assetPrefix: basePath || undefined,
  reactCompiler: true,
  reactStrictMode: false,
};

export default nextConfig;
