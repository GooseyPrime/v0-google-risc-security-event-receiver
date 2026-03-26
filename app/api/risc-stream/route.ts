import { NextResponse } from "next/server"
import { getAccessToken } from "@/lib/google-auth"

const RISC_SCOPE = "https://www.googleapis.com/auth/risc.configuration.readwrite"
const RISC_API_BASE = "https://risc.googleapis.com/v1beta"

/** All event types this receiver handles. */
const EVENTS_REQUESTED = [
  "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked",
  "https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked",
  "https://schemas.openid.net/secevent/risc/event-type/account-disabled",
  "https://schemas.openid.net/secevent/risc/event-type/account-enabled",
  "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required",
  "https://schemas.openid.net/secevent/risc/event-type/account-purged",
]

function getReceiverUrl(): string {
  const url =
    process.env.RECEIVER_URL ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/security-event-receiver`
      : null)

  if (!url) {
    throw new Error(
      "RECEIVER_URL environment variable is not set. " +
        "Set it to your deployed receiver URL, e.g. " +
        "https://your-app.vercel.app/security-event-receiver"
    )
  }
  return url
}

/**
 * GET /api/risc-stream
 * Retrieve the current RISC stream configuration from Google.
 */
export async function GET() {
  try {
    const accessToken = await getAccessToken(RISC_SCOPE)
    const response = await fetch(`${RISC_API_BASE}/stream`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const body = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: "RISC API error", details: body },
        { status: response.status }
      )
    }

    return NextResponse.json(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[RISC stream] GET failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/risc-stream
 * Register or update the push-delivery RISC stream with Google.
 * Safe to call multiple times — Google will upsert the configuration.
 */
export async function POST() {
  try {
    const receiverUrl = getReceiverUrl()
    const accessToken = await getAccessToken(RISC_SCOPE)

    const streamConfig = {
      delivery: {
        delivery_method:
          "https://schemas.openid.net/secevent/risc/delivery-method/push",
        url: receiverUrl,
      },
      events_requested: EVENTS_REQUESTED,
    }

    const response = await fetch(`${RISC_API_BASE}/stream:update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(streamConfig),
    })

    const body = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: "RISC API error", details: body },
        { status: response.status }
      )
    }

    console.log("[RISC stream] Stream registered/updated:", receiverUrl)
    return NextResponse.json({ success: true, receiverUrl, config: body })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[RISC stream] POST failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/risc-stream
 * Disable the RISC stream (sets status to DISABLED).
 */
export async function DELETE() {
  try {
    const accessToken = await getAccessToken(RISC_SCOPE)

    const response = await fetch(`${RISC_API_BASE}/stream:update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "DISABLED" }),
    })

    const body = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: "RISC API error", details: body },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, config: body })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[RISC stream] DELETE failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
