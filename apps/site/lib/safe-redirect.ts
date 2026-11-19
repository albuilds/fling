const FALLBACK_PATH = "/dashboard";

/**
 * Only allows redirects to paths on this site. Blocks open redirects such as
 * `//evil.com`, `https://evil.com` and `/\evil.com`, which browsers treat as
 * links to another site.
 */
export function getSafeCallbackUrl(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return FALLBACK_PATH;
  }

  try {
    const base = new URL("https://fling.invalid");
    const callback = new URL(value, base);
    if (callback.origin !== base.origin) return FALLBACK_PATH;
    return `${callback.pathname}${callback.search}${callback.hash}`;
  } catch {
    return FALLBACK_PATH;
  }
}
