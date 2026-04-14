// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";

const DEVICE_IDENTITY_DIRNAME = "openclaw-rocclaw";
const DEVICE_IDENTITY_FILENAME = "device.json";

/**
 * Persistent device identity (matches OpenClaw's internal format).
 * Keys are stored as PEM strings; deviceId is the hex sha256 of the raw public key.
 */
export type DeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

/**
 * Device auth params sent in the `connect` request.
 */
export type DeviceConnectParams = {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
};

const ALGORITHM = "ed25519";
const IDENTITY_VERSION = 1;

// Ed25519 SPKI DER prefix (ANSI ED25519 OID): 30 2a 30 05 06 03 2b 65 70 03 21 00
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

// ─── Base64url helpers ───────────────────────────────────────────────────────

const base64UrlEncode = (buf: Buffer): string =>
  buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");

// ─── Key utilities ────────────────────────────────────────────────────────────

/**
 * Extract the raw 32-byte Ed25519 public key from a SPKI DER or PEM.
 */
const derivePublicKeyRaw = (publicKeyPem: string): Buffer => {
  const spki = crypto.createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  });
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
};

/**
 * Device fingerprint: hex-encoded sha256 of the raw public key bytes.
 */
const fingerprintPublicKey = (publicKeyPem: string): string => {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash("sha256").update(raw).digest("hex");
};

/**
 * Export the raw public key as base64url (what the gateway expects in `device.publicKey`).
 */
export const publicKeyRawBase64UrlFromPem = (publicKeyPem: string): string =>
  base64UrlEncode(derivePublicKeyRaw(publicKeyPem));

// ─── Identity persistence ────────────────────────────────────────────────────

const resolveIdentityPath = (): string =>
  path.join(resolveStateDir(), DEVICE_IDENTITY_DIRNAME, DEVICE_IDENTITY_FILENAME);

const ensureDir = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

/**
 * Generate a new Ed25519 keypair and derive a device identity.
 */
const generateIdentity = (): DeviceIdentity => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync(ALGORITHM);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const deviceId = fingerprintPublicKey(publicKeyPem);
  return { deviceId, publicKeyPem, privateKeyPem };
};

/**
 * Load or create a persistent device identity from disk.
 * Matches OpenClaw's own `loadOrCreateDeviceIdentity` format.
 */
export const loadOrCreateDeviceIdentity = (filePath?: string): DeviceIdentity => {
  const resolvedPath = filePath ?? resolveIdentityPath();

  try {
    if (fs.existsSync(resolvedPath)) {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "version" in parsed &&
        (parsed as Record<string, unknown>).version === IDENTITY_VERSION &&
        typeof (parsed as Record<string, unknown>).deviceId === "string" &&
        typeof (parsed as Record<string, unknown>).publicKeyPem === "string" &&
        typeof (parsed as Record<string, unknown>).privateKeyPem === "string"
      ) {
        const record = parsed as unknown as {
          deviceId: string;
          publicKeyPem: string;
          privateKeyPem: string;
        };
        // Verify fingerprint matches (re-derive and fix if key was swapped)
        const derivedId = fingerprintPublicKey(record.publicKeyPem);
        if (derivedId && derivedId !== record.deviceId) {
          const updated = { ...record, deviceId: derivedId };
          fs.writeFileSync(resolvedPath, `${JSON.stringify(updated, null, 2)}\n`, {
            mode: 0o600,
          });
          try {
            fs.chmodSync(resolvedPath, 0o600);
          } catch {}
          return { deviceId: derivedId, publicKeyPem: record.publicKeyPem, privateKeyPem: record.privateKeyPem };
        }
        return {
          deviceId: record.deviceId,
          publicKeyPem: record.publicKeyPem,
          privateKeyPem: record.privateKeyPem,
        };
      }
    }
  } catch {
    // Corrupt or unreadable — regenerate
  }

  const identity = generateIdentity();
  ensureDir(resolvedPath);
  const stored = {
    version: IDENTITY_VERSION,
    deviceId: identity.deviceId,
    publicKeyPem: identity.publicKeyPem,
    privateKeyPem: identity.privateKeyPem,
    createdAtMs: Date.now(),
  };
  fs.writeFileSync(resolvedPath, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(resolvedPath, 0o600);
  } catch {}
  return identity;
};

// ─── Metadata normalization (matches gateway) ────────────────────────────────

/**
 * Normalize device metadata for auth payload: trim + lowercase ASCII.
 */
const normalizeDeviceMetadataForAuth = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/[A-Z]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 32)
  );
};

// ─── Signature payload (v3 format) ───────────────────────────────────────────

/**
 * Build the v3 device auth payload, matching the gateway's expected format:
 *
 * `v3|deviceId|clientId|clientMode|role|sortedScopes|signedAtMs|token|nonce|platform|deviceFamily`
 *
 * Scopes are joined by comma (not sorted by the builder — caller must sort).
 * Token is the raw auth token string.
 */
export const buildDeviceAuthPayloadV3 = (params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce: string;
  platform: string;
  deviceFamily: string;
}): string => {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const platform = normalizeDeviceMetadataForAuth(params.platform);
  const deviceFamily = normalizeDeviceMetadataForAuth(params.deviceFamily);
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join("|");
};

/**
 * Sign a payload string with an Ed25519 private key (PEM) and return base64url signature.
 */
const signDevicePayload = (privateKeyPem: string, payload: string): string => {
  const key = crypto.createPrivateKey(privateKeyPem);
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, "utf8"), key));
};

/**
 * Build the `device` connect params with a v3 signature.
 */
export const signConnectChallenge = (
  identity: DeviceIdentity,
  params: {
    nonce: string;
    platform: string;
    deviceFamily: string;
    role: string;
    scopes: string[];
    client: { id: string; version: string; mode: string };
    token: string;
  }
): DeviceConnectParams => {
  const signedAtMs = Date.now();

  const payload = buildDeviceAuthPayloadV3({
    deviceId: identity.deviceId,
    clientId: params.client.id,
    clientMode: params.client.mode,
    role: params.role,
    scopes: params.scopes,
    signedAtMs,
    token: params.token,
    nonce: params.nonce,
    platform: params.platform,
    deviceFamily: params.deviceFamily,
  });

  const signature = signDevicePayload(identity.privateKeyPem, payload);

  return {
    id: identity.deviceId,
    publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
    signature,
    signedAt: signedAtMs,
    nonce: params.nonce,
  };
};