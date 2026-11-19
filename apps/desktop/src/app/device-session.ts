// Connects the desktop app to a Fling account and keeps its device token.
//
// Sign-in uses the OAuth 2.0 device authorization flow (RFC 8628), the same
// pattern as signing in on a TV:
//   1. Ask the server to start: it returns a secret device code (kept here)
//      and a short user code (shown to the user).
//   2. Open the browser so the user signs in with Google and approves the
//      user code.
//   3. Poll the server with the device code until it is approved. The server
//      then returns a long-lived device token exactly once.
//   4. Encrypt the token with the OS keychain (safeStorage) and save it.

import { app, clipboard, safeStorage, shell } from "electron";
import fs from "fs/promises";
import path from "path";
import { toTrustedServerUrl } from "./urls";
import type { AuthState, DeviceUser } from "./types";

const DEVICE_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const USER_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

type StartResponse = {
  deviceCode: string;
  userCode: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

type PollResponse = {
  accessToken?: string;
  error?: string;
  user?: DeviceUser;
};

/** Hooks the session uses to update the UI while signing in. */
export type SignInCallbacks = {
  /** Show the sign-in page with this user code. */
  onPending: (userCode: string) => Promise<void>;
  onComplete: (user: DeviceUser) => void;
  onError: (message: string) => void;
};

function getTokenPath() {
  return path.join(app.getPath("userData"), "device-auth.bin");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeviceSession {
  private token: string | null = null;
  private user: DeviceUser | null = null;
  private signInPromise: Promise<AuthState> | null = null;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly onChange: () => void,
  ) {}

  get state(): AuthState {
    return { signedIn: Boolean(this.token), user: this.user };
  }

  /** Authorization header for API requests, or null when signed out. */
  get authorizationHeader() {
    return this.token ? `Bearer ${this.token}` : null;
  }

  /** Restores a saved token and confirms with the server that it still works. */
  async restore() {
    try {
      const encrypted = await fs.readFile(getTokenPath());
      if (!safeStorage.isEncryptionAvailable()) return;
      this.token = safeStorage.decryptString(encrypted);

      const response = await fetch(`${this.apiBaseUrl}/api/device-auth/me`, {
        headers: { authorization: `Bearer ${this.token}` },
      });
      if (!response.ok) {
        throw new Error("Stored device session is no longer valid");
      }
      const result = (await response.json()) as { user: DeviceUser };
      this.user = result.user;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn("Could not restore device sign-in", error);
      }
      this.token = null;
      this.user = null;
    }
  }

  /**
   * Starts sign-in, or returns the sign-in already in progress so clicking
   * "Sign in" twice does not start two flows.
   */
  signIn(callbacks: SignInCallbacks): Promise<AuthState> {
    if (this.token) return Promise.resolve(this.state);
    if (this.signInPromise) return this.signInPromise;

    this.signInPromise = this.runDeviceFlow(callbacks)
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Could not connect Fling";
        callbacks.onError(message);
        throw error;
      })
      .finally(() => {
        this.signInPromise = null;
      });
    return this.signInPromise;
  }

  get isSigningIn() {
    return this.signInPromise !== null;
  }

  /** Revokes the token on the server (best effort) and deletes it locally. */
  async signOut(): Promise<AuthState> {
    if (this.token) {
      await fetch(`${this.apiBaseUrl}/api/device-auth/revoke`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}` },
      }).catch(() => undefined);
    }
    this.token = null;
    this.user = null;
    await fs.unlink(getTokenPath()).catch(() => undefined);
    this.onChange();
    return this.state;
  }

  private async runDeviceFlow(callbacks: SignInCallbacks): Promise<AuthState> {
    await callbacks.onPending("••••-••••");
    const authorization = await this.startAuthorization();

    clipboard.writeText(authorization.userCode);
    await callbacks.onPending(authorization.userCode);
    await shell.openExternal(authorization.verificationUriComplete);

    const deadline = Date.now() + authorization.expiresIn * 1000;
    while (Date.now() < deadline) {
      const result = await this.poll(authorization.deviceCode);
      if (result.accessToken && result.user) {
        await this.saveToken(result.accessToken);
        this.token = result.accessToken;
        this.user = result.user;
        this.onChange();
        callbacks.onComplete(result.user);
        return this.state;
      }
      if (result.error !== "authorization_pending") break;
      await sleep(authorization.interval * 1000);
    }

    throw new Error("Device sign-in expired or was not approved");
  }

  /** Asks the server for codes and checks the response before trusting it. */
  private async startAuthorization(): Promise<StartResponse> {
    const response = await fetch(`${this.apiBaseUrl}/api/device-auth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceName: `${process.platform} desktop` }),
    });
    if (!response.ok) throw new Error("Could not start device sign-in");

    const body = (await response.json()) as StartResponse;
    const verificationUrl = toTrustedServerUrl(
      body.verificationUriComplete,
      this.apiBaseUrl,
    );
    const isValid =
      verificationUrl !== null &&
      typeof body.deviceCode === "string" &&
      DEVICE_CODE_PATTERN.test(body.deviceCode) &&
      typeof body.userCode === "string" &&
      USER_CODE_PATTERN.test(body.userCode) &&
      Number.isFinite(body.expiresIn) &&
      body.expiresIn > 0 &&
      body.expiresIn <= 900 &&
      Number.isFinite(body.interval) &&
      body.interval >= 1 &&
      body.interval <= 30;
    if (!isValid) {
      throw new Error("The sign-in server returned an invalid response");
    }

    return { ...body, verificationUriComplete: verificationUrl };
  }

  private async poll(deviceCode: string): Promise<PollResponse> {
    const response = await fetch(`${this.apiBaseUrl}/api/device-auth/poll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceCode }),
    });
    const result = (await response.json()) as PollResponse;
    return response.ok ? result : { error: result.error };
  }

  /** Encrypts the token with the OS keychain and saves it readable only by this user. */
  private async saveToken(token: string) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Secure credential storage is unavailable on this device");
    }
    const tokenPath = getTokenPath();
    await fs.mkdir(path.dirname(tokenPath), { recursive: true, mode: 0o700 });
    await fs.writeFile(tokenPath, safeStorage.encryptString(token), {
      mode: 0o600,
    });
    await fs.chmod(tokenPath, 0o600).catch(() => undefined);
  }
}
