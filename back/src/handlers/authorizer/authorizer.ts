import { timingSafeEqual, createHash } from "crypto";
import type { APIGatewayRequestSimpleAuthorizerHandlerV2 } from "aws-lambda";
import { Resource } from "sst";

const CLOUDFLARE_IPV4_URL = "https://www.cloudflare.com/ips-v4";
const CLOUDFLARE_IPV6_URL = "https://www.cloudflare.com/ips-v6";
const CACHE_TTL_MS = 60 * 60 * 1000;

let cfIpv4Ranges: string[] = [];
let cfIpv6Ranges: string[] = [];
let lastFetchTime = 0;

/**
 * Fetches and caches Cloudflare's published IPv4 and IPv6 CIDR ranges.
 * Results are cached in module scope for 1 hour to avoid a fetch on every invocation.
 * If a refresh fails but stale data exists, the old ranges are kept silently.
 *
 * @throws {Error} If the fetch fails and no cached ranges are available.
 */
async function fetchCloudflareIPs(): Promise<void> {
  const now = Date.now();
  if (cfIpv4Ranges.length > 0 && now - lastFetchTime < CACHE_TTL_MS) return;

  const [v4Response, v6Response] = await Promise.all([
    fetch(CLOUDFLARE_IPV4_URL),
    fetch(CLOUDFLARE_IPV6_URL),
  ]);

  if (!v4Response.ok || !v6Response.ok) {
    // Si el fetch falla y ya tenemos rangos cacheados, seguir usando los anteriores
    if (cfIpv4Ranges.length > 0) return;
    throw new Error("Failed to fetch Cloudflare IP ranges and no cache available");
  }

  const [v4Text, v6Text] = await Promise.all([v4Response.text(), v6Response.text()]);

  cfIpv4Ranges = v4Text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  cfIpv6Ranges = v6Text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  lastFetchTime = now;
}

/**
 * Converts a dotted-decimal IPv4 address to an unsigned 32-bit integer.
 * The `>>> 0` coercion is required to keep the result unsigned — without it,
 * addresses above `127.x.x.x` would produce negative numbers in JS bitwise ops.
 *
 * @param ip - IPv4 address, e.g. `"173.245.48.1"`.
 * @returns Unsigned 32-bit integer representation.
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
  );
}

/**
 * Returns `true` if the IPv4 address falls within the given CIDR block.
 * Works by applying the prefix mask to both addresses and comparing the results.
 *
 * @param ip   - IPv4 address, e.g. `"173.245.48.1"`.
 * @param cidr - CIDR block, e.g. `"173.245.48.0/20"`.
 *
 * @example
 * isIPv4InCIDR("173.245.48.1", "173.245.48.0/20") // → true
 */
function isIPv4InCIDR(ip: string, cidr: string): boolean {
  const [base, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr!, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base!) & mask);
}

/**
 * Returns `true` if the IPv6 address falls within the given CIDR block.
 * Uses `BigInt` for 128-bit arithmetic and handles `::` shorthand expansion.
 *
 * @param ip   - IPv6 address with or without `::`, e.g. `"2606:4700::1"`.
 * @param cidr - CIDR block, e.g. `"2606:4700::/32"`.
 *
 * @example
 * isIPv6InCIDR("2606:4700::1", "2606:4700::/32") // → true
 */
function isIPv6InCIDR(ip: string, cidr: string): boolean {
  const [base, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr!, 10);

  const expandIPv6 = (addr: string): bigint => {
    // Manejar "::" abreviación
    const parts = addr.split("::");
    let left = parts[0] ? parts[0].split(":") : [];
    let right = parts[1] ? parts[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    const full = [...left, ...Array(missing).fill("0"), ...right];
    return full.reduce((acc, h) => (acc << 16n) | BigInt(parseInt(h || "0", 16)), 0n);
  };

  const ipInt = expandIPv6(ip);
  const baseInt = expandIPv6(base!);
  const mask = prefix === 0 ? 0n : (~0n << BigInt(128 - prefix)) & ((1n << 128n) - 1n);

  return (ipInt & mask) === (baseInt & mask);
}

/**
 * Returns `true` if `sourceIp` belongs to a Cloudflare CIDR range.
 * Detects the address family by the presence of `:` and checks the
 * corresponding range list. Malformed CIDR entries are silently skipped.
 *
 * @param sourceIp - Source IP from the API Gateway event.
 */
function isCloudflareIP(sourceIp: string): boolean {
  const isIPv6 = sourceIp.includes(":");

  if (isIPv6) {
    return cfIpv6Ranges.some((cidr) => {
      try {
        return isIPv6InCIDR(sourceIp, cidr);
      } catch {
        return false;
      }
    });
  }

  return cfIpv4Ranges.some((cidr) => {
    try {
      return isIPv4InCIDR(sourceIp, cidr);
    } catch {
      return false;
    }
  });
}

/**
 * Compares two secrets in constant time to prevent timing attacks.
 * Both strings are hashed with SHA-256 before comparison so that
 * `timingSafeEqual` always receives buffers of equal length, regardless
 * of the original string lengths.
 *
 * @param incoming - Secret received in the `Custom-secret` request header.
 * @param expected - Secret stored in SST Secrets / AWS SSM.
 * @returns `true` if both secrets are identical.
 */
function isSecretValid(incoming: string, expected: string): boolean {
  // Usar hash para igualar la longitud y evitar revelar la longitud del secreto
  const incomingHash = createHash("sha256").update(incoming).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(incomingHash, expectedHash);
}

export const handler: APIGatewayRequestSimpleAuthorizerHandlerV2 = async (event) => {
  const DENY = { isAuthorized: false } as const;

  const incomingSecret = event.headers?.["custom-secret"];
  if (!incomingSecret) return DENY;

  const expectedSecret = Resource.CloudflareSecret.value;
  if (!isSecretValid(incomingSecret, expectedSecret)) return DENY;

  try {
    await fetchCloudflareIPs();
  } catch {
    return DENY;
  }

  const sourceIp = event.requestContext.http.sourceIp;
  if (!sourceIp || !isCloudflareIP(sourceIp)) return DENY;

  return { isAuthorized: true };
};
