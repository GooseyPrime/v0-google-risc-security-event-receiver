// In-memory store for security events
// In production, replace with a database (Supabase, Neon, etc.)

export interface SecurityEvent {
  id: string
  jti: string
  eventType: string
  eventData: Record<string, unknown>
  subject?: {
    subject_type?: string
    iss?: string
    sub?: string
  }
  receivedAt: string
  issuer: string
}

// In-memory storage (will reset on server restart)
// For production, use a database
const events: SecurityEvent[] = []
const MAX_EVENTS = 1000 // Keep last 1000 events in memory

export function addEvent(event: Omit<SecurityEvent, "id">): SecurityEvent {
  const newEvent: SecurityEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  }

  events.unshift(newEvent) // Add to beginning (newest first)

  // Trim to max size
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS
  }

  return newEvent
}

export function getEvents(limit = 100, offset = 0): SecurityEvent[] {
  return events.slice(offset, offset + limit)
}

export function getEventById(id: string): SecurityEvent | undefined {
  return events.find((e) => e.id === id)
}

export function getEventsBySubject(sub: string): SecurityEvent[] {
  return events.filter((e) => e.subject?.sub === sub)
}

export function getEventCount(): number {
  return events.length
}

export function clearEvents(): void {
  events.length = 0
}

// Event type labels for display
export const EVENT_TYPE_LABELS: Record<string, string> = {
  "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked": "Sessions Revoked",
  "https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked": "Tokens Revoked",
  "https://schemas.openid.net/secevent/risc/event-type/account-disabled": "Account Disabled",
  "https://schemas.openid.net/secevent/risc/event-type/account-enabled": "Account Enabled",
  "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required": "Credential Change Required",
  "https://schemas.openid.net/secevent/risc/event-type/account-purged": "Account Purged",
  "https://schemas.openid.net/secevent/risc/event-type/verification": "Verification",
}

export function getEventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] || eventType.split("/").pop() || "Unknown"
}
