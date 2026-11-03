import { randomUUID } from "crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises"
import path from "path"
import { z } from "zod"

const eventDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    { message: "Enter a valid event date." },
  )

const eventFieldsSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    date: eventDateSchema,
    endDate: eventDateSchema.optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional()
      .or(z.literal("")),
    location: z.string().trim().max(120),
    description: z.string().trim().max(2000),
  })
  .strict()

const orderedEventSchema = eventFieldsSchema.refine(
  (event) => !event.endDate || event.endDate >= event.date,
  {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  },
)

export const calendarEventSchema = orderedEventSchema.transform((event) => ({
  ...event,
  endDate: event.endDate ?? event.date,
}))

export const calendarEventInputSchema = eventFieldsSchema
  .omit({ id: true })
  .extend({ id: z.string().min(1).optional() })
  .refine((event) => !event.endDate || event.endDate >= event.date, {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  })

const calendarEventsSchema = z.array(calendarEventSchema)
export type CalendarEvent = z.infer<typeof calendarEventSchema>

const dataDirectory = path.join(process.cwd(), "data")
const eventsFile = path.join(dataDirectory, "events.json")

export async function getAllEvents(): Promise<CalendarEvent[]> {
  const contents = await readFile(eventsFile, "utf8")
  const parsed = calendarEventsSchema.safeParse(JSON.parse(contents))

  if (!parsed.success) {
    throw new Error(`Event data is invalid: ${parsed.error.message}`)
  }

  return parsed.data.sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      (first.time || "").localeCompare(second.time || "") ||
      first.title.localeCompare(second.title),
  )
}

export async function saveEvents(events: CalendarEvent[]): Promise<void> {
  await mkdir(dataDirectory, { recursive: true })
  const temporaryFile = path.join(dataDirectory, `events-${randomUUID()}.tmp`)

  try {
    await writeFile(temporaryFile, `${JSON.stringify(events, null, 2)}\n`, "utf8")
    await rename(temporaryFile, eventsFile)
  } catch (error) {
    await unlink(temporaryFile).catch(() => undefined)
    throw error
  }
}
