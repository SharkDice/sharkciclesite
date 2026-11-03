import Link from "next/link"
import { Navigation } from "@/components/navigation"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export const metadata = {
  title: "Frequently Asked Questions | Sharkcicle SMP",
  description: "Answers to common questions about joining and playing on Sharkcicle SMP.",
}

const frequentlyAskedQuestions = [
  {
    question: "How do I join Sharkcicle SMP?",
    answer: (
      <>
        Join our{" "}
        <Link
          href="https://discord.com/invite/UNBQwEdaaP"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
        >
          Discord community
        </Link>{" "}
        to get started. Applications must be approved before you can join the server.
      </>
    ),
  },
  {
    question: "Why is there an application?",
    answer:
      "Our application process helps protect the server from griefing and supports the close-knit community we've built. Requiring an application helps us get to know prospective players and ensure they want to join with good intentions.",
  },
  {
    question: "Is there an age limit?",
    answer:
      "There is no age limit, but the server is recommended for players aged 12 and older. Some swearing and mature topics may come up, though we try to keep these to a minimum around minors. If you or another player has an issue with someone’s behavior, please tell an administrator as soon as possible. Inappropriate behavior is not tolerated.",
  },
  {
    question: "What measures are in place to prevent griefing?",
    answer: (
      <>
        All players have access to CoreProtect inspection. Type{" "}
        <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-cyan-200">
          /co inspect
        </code>{" "}
        to toggle inspection mode and see who is placing or breaking blocks, or
        taking items from chests. If you notice possible griefing or theft,
        report it to an administrator right away. CoreProtect makes it easy to
        roll back damage, and the server is backed up daily.
      </>
    ),
  },
  {
    question: "Are mods allowed?",
    answer: (
      <>
        Yes, as long as a mod does not give you an unfair advantage. We
        recommend mods such as Bobby, Litematica, and minimaps. X-ray mods and
        hacked clients are not allowed.
      </>
    ),
  },
  {
    question: "Is there PvP on the server?",
    answer:
      "PvP is only allowed when everyone involved agrees to participate. If someone kills you without your consent, report it to an administrator so they can address the incident and help restore your inventory. We are a friendly community, so PvP is uncommon outside of minigames.",
  },
  {
    question: "Does the world reset?",
    answer:
      "No. We have played on the same world since December 2021, and we have no plans to reset it. Your progress and creations will remain part of the world.",
  },
  {
    question: "I joined a server and it shut down after a month. Will this server shut down?",
    answer:
      "Sharkcicle SMP has been running smoothly since December 2021, and we are committed to keeping the server online and operational.",
  },
  {
    question: "What makes this server different from other servers?",
    answer:
      "Sharkcicle SMP gives players a great deal of freedom. From server tools that help you build and manage your creations to commands and plugins that support your projects, we want to give you the tools to bring your ideas to life. Our close-knit community welcomes everyone to share their favorite topics and special interests. Here, the power is in the players.",
  },
]

export default function FAQPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[#1A1C1E] px-4 py-8 text-white">
        <section className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Need a hand?
            </p>
            <h1 className="mt-2 text-4xl font-bold">Frequently Asked Questions</h1>
            <p className="mt-3 text-gray-300">
              Quick answers to common questions about Sharkcicle SMP.
            </p>
          </div>

          <Accordion
            type="single"
            collapsible
            className="rounded-lg border border-white/10 bg-[#2C2F33] px-6"
          >
            {frequentlyAskedQuestions.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`question-${index + 1}`}
                className="border-white/10 last:border-b-0"
              >
                <AccordionTrigger className="text-left text-base hover:no-underline sm:text-lg">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-gray-300">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="mt-8 text-center text-gray-400">
            Still have a question?{" "}
            <Link
              href="https://discord.com/invite/UNBQwEdaaP"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
            >
              Ask the community on Discord
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  )
}
