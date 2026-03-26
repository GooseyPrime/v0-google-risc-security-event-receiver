import { NextRequest, NextResponse } from "next/server"
import * as jose from "jose"
import { addEvent } from "@/lib/events-store"

// Allowed OAuth client IDs for InTellMe projects
const ALLOWED_CLIENT_IDS = [
  "512852924896-bipo81kgpes320pivlunlh8897bsn038.apps.googleusercontent.com",
  "512852924896-mkfn3gbgltmp9u55dspqmbag3oljv726.apps.googleusercontent.com",
  "512852924896-2nhh354ns3ulgpgah3snafp24pt9n347.apps.googleusercontent.com",
  "512852924896-h10347q881ir4un05lfkqt4q7b9csc9p.apps.googleusercontent.com",
  "512852924896-tprr4bk7p19mtetb1r5i0la6aiav1qn7.apps.googleusercontent.com",
  "512852924896-dprrp9mcgpoh40cqk91i30qqr67ijtj5.apps.googleusercontent.com",
  "512852924896-4qdklbl5oihtr51hbr9uo2indbri944l.apps.googleusercontent.com",
]

// Google's RISC issuer
const GOOGLE_ISSUER = "https://accounts.google.com"

// Expected audience (your receiver URL)
const EXPECTED_AUDIENCE = "https://risc.intellmeai.com/security-event-receiver"

// Cache for Google's JWKS
let jwksCache: jose.JWTVerifyGetKey | null = null

async function getGoogleJWKS(): Promise<jose.JWTVerifyGetKey> {
  if (!jwksCache) {
    jwksCache = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))
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
    audience: EXPECTED_AUDIENCE,
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
      // Validate the subject contains an allowed client ID (if applicable)
      const subject = eventData?.subject
      if (subject?.iss && !ALLOWED_CLIENT_IDS.includes(subject.iss)) {
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
    project: "InTellMe",
    endpoint: "/security-event-receiver",
  })
}
