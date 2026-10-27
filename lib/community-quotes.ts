import { readFile } from "fs/promises"
import path from "path"
import { z } from "zod"

const communityQuoteSchema = z
  .object({
    quote: z.string().trim().min(1).max(500),
    author: z.string().trim().min(1).max(80).optional(),
    context: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

const communityQuotesSchema = z.array(communityQuoteSchema)
export type CommunityQuote = z.infer<typeof communityQuoteSchema>

const quotesFile = path.join(process.cwd(), "data", "community-quotes.json")

export async function getCommunityQuotes(): Promise<CommunityQuote[]> {
  const contents = await readFile(quotesFile, "utf8")
  const parsed = communityQuotesSchema.safeParse(JSON.parse(contents))

  if (!parsed.success) {
    throw new Error(`Community quote data is invalid: ${parsed.error.message}`)
  }

  return parsed.data
}
