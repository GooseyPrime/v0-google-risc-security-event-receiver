/**
 * Service account authentication helper.
 * Uses `jose` (already a dependency) to sign JWT assertions and exchange
 * them for Google OAuth 2.0 access tokens – no extra packages required.
 */

import * as jose from "jose"

export interface ServiceAccountKey {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
}

interface CachedToken {
  token: string
  expiresAt: number
}

// Refresh the cached token this many milliseconds before it actually expires.
const TOKEN_REFRESH_BUFFER_MS = 60_000

// One cached token per scope so we don't hit Google's token endpoint on every request.
// Tokens are valid for 1 hour; we refresh TOKEN_REFRESH_BUFFER_MS before expiry.
const tokenCache = new Map<string, CachedToken>()

/**
 * Parse the service account key from the `GOOGLE_SERVICE_ACCOUNT_KEY`
 * environment variable.  The value may be:
 *   • a raw JSON string, or
 *   • the same JSON string Base64-encoded (useful for some hosting platforms).
 */
export function getServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. " +
        "Set it to the contents of your service account JSON key file " +
        "(raw JSON or Base64-encoded JSON)."
    )
  }

  let json = raw.trim()

  // Try to decode as Base64 first; fall back to treating it as raw JSON.
  if (!json.startsWith("{")) {
    try {
      json = Buffer.from(json, "base64").toString("utf-8")
    } catch {
      // Not valid Base64 — leave json unchanged and let JSON.parse throw.
    }
  }

  return JSON.parse(json) as ServiceAccountKey
}

/**
 * Returns the service account email address from the environment variable,
 * or `null` if the variable is not set or cannot be parsed.
 * Safe to call from server components — never throws.
 */
export function getServiceAccountEmail(): string | null {
  try {
    return getServiceAccountKey().client_email
  } catch {
    return null
  }
}

/**
 * Obtain a Google OAuth 2.0 access token for the given scope.
 * Results are cached and automatically refreshed before expiry.
 */
export async function getAccessToken(scope: string): Promise<string> {
  const cached = tokenCache.get(scope)
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return cached.token
  }

  const key = getServiceAccountKey()
  const now = Math.floor(Date.now() / 1000)

  const privateKey = await jose.importPKCS8(key.private_key, "RS256")

  const assertion = await new jose.SignJWT({
    iss: key.client_email,
    sub: key.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope,
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256", kid: key.private_key_id })
    .sign(privateKey)

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Google token exchange failed (${response.status}): ${body}`
    )
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }

  const entry: CachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  tokenCache.set(scope, entry)

  return entry.token
}
