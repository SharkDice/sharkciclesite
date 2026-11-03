import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  calendarEventInputSchema,
  getAllEvents,
  saveEvents,
  type CalendarEvent,
} from "@/lib/events"
import { authorizeNewsAdmin } from "@/lib/news-auth"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const deleteInputSchema = z.object({ id: z.string().min(1) }).strict()

function storageError(error: unknown, action: string): NextResponse {
  console.error(`Unable to ${action} calendar events:`, error)
  return NextResponse.json(
    { error: `Unable to ${action} calendar events. Check the server logs for details.` },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeNewsAdmin(request)
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json(await getAllEvents(), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return storageError(error, "read")
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = authorizeNewsAdmin(request)
  if (unauthorized) return unauthorized

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const parsedInput = calendarEventInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: parsedInput.error.issues[0]?.message ?? "Event details are invalid." },
      { status: 400 },
    )
  }

  try {
    const events = await getAllEvents()
    const eventId = parsedInput.data.id
    const existingIndex = eventId
      ? events.findIndex((event) => event.id === eventId)
      : -1

    if (eventId && existingIndex < 0) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 })
    }

    const event: CalendarEvent = {
      ...parsedInput.data,
      id: eventId ?? randomUUID(),
      endDate: parsedInput.data.endDate ?? parsedInput.data.date,
    }

    if (existingIndex >= 0) {
      events[existingIndex] = event
    } else {
      events.push(event)
    }

    await saveEvents(events)
    return NextResponse.json({ event })
  } catch (error) {
    return storageError(error, "save")
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = authorizeNewsAdmin(request)
  if (unauthorized) return unauthorized

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const parsedInput = deleteInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return NextResponse.json({ error: "A valid event ID is required." }, { status: 400 })
  }

  try {
    const events = await getAllEvents()
    if (!events.some((event) => event.id === parsedInput.data.id)) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 })
    }

    await saveEvents(events.filter((event) => event.id !== parsedInput.data.id))
    return NextResponse.json({ success: true })
  } catch (error) {
    return storageError(error, "delete")
  }
}
