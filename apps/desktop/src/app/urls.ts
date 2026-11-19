// URL checks for the Fling server and links the app opens.

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];

/**
 * Validates FLING_API_URL. Plain HTTP is only allowed on this machine, so
 * device tokens are never sent over an unencrypted network connection.
 */
export function normalizeApiBaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("FLING_API_URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("FLING_API_URL must not include credentials");
  }

  const isLoopback = LOOPBACK_HOSTS.includes(url.hostname);
  if (url.protocol === "http:" && !isLoopback) {
    throw new Error("FLING_API_URL must use https except on localhost");
  }

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

/** Returns the value when it is an http(s) URL without credentials. */
function toHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Returns the URL only when it points at the configured Fling server. Used
 * before opening a link or copying it, so a bad server response cannot make
 * the app open an arbitrary site.
 */
export function toTrustedServerUrl(value: unknown, apiBaseUrl: string) {
  const url = toHttpUrl(value);
  if (!url) return null;
  return new URL(url).origin === new URL(apiBaseUrl).origin ? url : null;
}
