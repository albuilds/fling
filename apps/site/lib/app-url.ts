export function getAppOrigin(requestUrl?: string) {
  const candidate = process.env.APP_BASE_URL || requestUrl;

  if (!candidate) {
    throw new Error("APP_BASE_URL is not configured");
  }

  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_BASE_URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("APP_BASE_URL must not include credentials");
  }

  return url.origin;
}
