// File locations of the app's pages, preload script, and icon.
//
// Compiled code lives in dist/ and the HTML pages stay in src/, so paths are
// built from the desktop app's root folder.

import path from "path";
import { pathToFileURL } from "url";

const APP_ROOT = path.join(__dirname, "..", "..");

export const APP_PAGES = [
  "history.html",
  "index.html",
  "screenshot-overlay.html",
  "sign-in.html",
  "video-overlay.html",
] as const;

export type AppPage = (typeof APP_PAGES)[number];

export const PRELOAD_PATH = path.join(APP_ROOT, "dist", "preload.js");
export const ICON_PATH = path.join(APP_ROOT, "src", "assets", "fling-logo.png");

export function pagePath(page: AppPage) {
  return path.join(APP_ROOT, "src", page);
}

const TRUSTED_PAGE_URLS = new Set(
  APP_PAGES.map((page) => pathToFileURL(pagePath(page)).toString()),
);

/** True only for the app's own local pages (query string and hash ignored). */
export function isTrustedAppUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return TRUSTED_PAGE_URLS.has(url.toString());
  } catch {
    return false;
  }
}
