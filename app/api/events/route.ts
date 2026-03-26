import { NextRequest, NextResponse } from "next/server"
import { getEvents, getEventCount, clearEvents } from "@/lib/events-store"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const offset = parseInt(searchParams.get("offset") || "0")

  const events = getEvents(limit, offset)
  const total = getEventCount()

  return NextResponse.json({
    events,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  })
}

// Clear all events (for testing/admin purposes)
export async function DELETE() {
  clearEvents()
  return NextResponse.json({ success: true, message: "All events cleared" })
}
