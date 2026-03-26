import { NextRequest, NextResponse } from "next/server"
import * as jose from "jose"
import { addEvent } from "@/lib/events-store"

// Google's RISC issuer
const GOOGLE_ISSUER = "https://accounts.google.com"

/**
 * The audience value must exactly match what was registered with Google as
 * the receiver URL.  Configure this via the RECEIVER_URL environment variable.
 *
 * If RECEIVER_URL is not set we fall back to constructing the URL from
 * NEXT_PUBLIC_APP_URL so local development still works without extra config.
 */
function getExpectedAudience(): string {
  return (
    process.env.RECEIVER_URL ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/security-event-receiver`
      : "https://risc.intellmeai.com/security-event-receiver")
  )
}

/**
 * Optional allow-list of OAuth client IDs (the `iss` field in the event
 * subject).  Set ALLOWED_CLIENT_IDS as a comma-separated list of full client
 * IDs (including ".apps.googleusercontent.com") to restrict which clients
 * are accepted.  Leave unset to accept events from any registered client.
 */
function getAllowedClientIds(): Set<string> | null {
  const raw = process.env.ALLOWED_CLIENT_IDS
  if (!raw) return null // no restriction
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

// Cache for Google's JWKS
let jwksCache: jose.JWTVerifyGetKey | null = null

async function getGoogleJWKS(): Promise<jose.JWTVerifyGetKey> {
  if (!jwksCache) {
    jwksCache = jose.createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs")
    )
  }
  return jwksCache
}

interface SecurityEventToken {
  iss: string
  aud: string
  iat: number
  jti: string
  events: Record<string, { subject?: { subject_type?: string; iss?: string; sub?: string } }>
}

async function verifySecurityEventToken(token: string): Promise<SecurityEventToken> {
  const jwks = await getGoogleJWKS()

  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: GOOGLE_ISSUER,
    audience: getExpectedAudience(),
  })

  return payload as unknown as SecurityEventToken
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body as text (JWT token)
    const token = await request.text()

    if (!token) {
      console.error("[RISC] No token provided in request body")
      return NextResponse.json({ error: "No token provided" }, { status: 400 })
    }

    // Verify the token
    let payload: SecurityEventToken
    try {
      payload = await verifySecurityEventToken(token)
    } catch (error) {
      console.error("[RISC] Token verification failed:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Log the received event
    console.log(`[RISC] Received security event from ${payload.iss}, jti: ${payload.jti}`)

    // Process each event in the token
    const events = payload.events
    if (!events || typeof events !== "object") {
      console.error("[RISC] No events in token")
      return NextResponse.json({ error: "No events in token" }, { status: 400 })
    }

    for (const [eventType, eventData] of Object.entries(events)) {
      // Validate the subject contains an allowed client ID (if configured)
      const subject = eventData?.subject
      const allowedClientIds = getAllowedClientIds()
      if (allowedClientIds && subject?.iss && !allowedClientIds.has(subject.iss)) {
        console.warn(`[RISC] Event from unknown client ID: ${subject.iss}`)
      }

      // Store the event
      const storedEvent = addEvent({
        jti: payload.jti,
        eventType,
        eventData: eventData as Record<string, unknown>,
        subject: subject,
        receivedAt: new Date().toISOString(),
        issuer: payload.iss,
      })

      console.log(`[RISC] Stored event ${storedEvent.id}: ${eventType}`)
    }

    // Return 202 Accepted as per RISC spec
    return new NextResponse(null, { status: 202 })
  } catch (error) {
    console.error("[RISC] Error processing security event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Google RISC Receiver",
    audience: getExpectedAudience(),
  })
}
