// Calls the Fling server's capture API with the device token.

import type { DeviceSession } from "./device-session";
import { toTrustedServerUrl } from "./urls";

export type CaptureList = {
  signedIn: boolean;
  captures: unknown[];
};

export class FlingApi {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly session: DeviceSession,
  ) {}

  /**
   * Uploads a capture and returns its share link, or null when signed out.
   * The link is only returned if it points at the Fling server.
   */
  async uploadCapture(
    data: Buffer,
    title: string,
    mimeType: string,
    durationMs?: number,
  ): Promise<string | null> {
    const authorization = this.session.authorizationHeader;
    if (!authorization) return null;

    const response = await fetch(`${this.apiBaseUrl}/api/captures`, {
      method: "POST",
      headers: {
        authorization,
        "content-type": mimeType,
        "x-fling-title": encodeURIComponent(title),
        ...(durationMs === undefined
          ? {}
          : { "x-fling-duration-ms": String(durationMs) }),
      },
      body: new Uint8Array(data),
    });
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(
        `Upload failed (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }

    const result = (await response.json()) as { shareUrl?: unknown };
    const shareUrl = toTrustedServerUrl(result.shareUrl, this.apiBaseUrl);
    if (!shareUrl) {
      throw new Error("The upload server returned an invalid share URL");
    }
    return shareUrl;
  }

  /** Lists the account's recent captures for the History page. */
  async listCaptures(): Promise<CaptureList> {
    const authorization = this.session.authorizationHeader;
    if (!authorization) return { signedIn: false, captures: [] };

    const response = await fetch(`${this.apiBaseUrl}/api/captures`, {
      headers: { authorization },
    });
    if (response.status === 401) {
      return { signedIn: false, captures: [] };
    }
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(
        `Could not load history (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }

    const result = (await response.json()) as { captures?: unknown };
    return {
      signedIn: true,
      captures: Array.isArray(result.captures) ? result.captures : [],
    };
  }
}
