"use client"

import { useEffect, useRef, useState } from "react"
import { Quote } from "lucide-react"
import type { CommunityQuote as CommunityQuoteItem } from "@/lib/community-quotes"

const ROTATION_INTERVAL = 8000
const FADE_DURATION = 500

function shuffleQuotes(quotes: CommunityQuoteItem[]): CommunityQuoteItem[] {
  const shuffled = [...quotes]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

interface CommunityQuotesProps {
  quotes: CommunityQuoteItem[]
}

export function CommunityQuotes({ quotes }: CommunityQuotesProps) {
  const [orderedQuotes, setOrderedQuotes] = useState(quotes)
  const [hasShuffled, setHasShuffled] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const orderedQuotesRef = useRef(orderedQuotes)
  const currentIndexRef = useRef(currentIndex)

  orderedQuotesRef.current = orderedQuotes
  currentIndexRef.current = currentIndex

  useEffect(() => {
    setOrderedQuotes(shuffleQuotes(quotes))
    setHasShuffled(true)
  }, [quotes])

  useEffect(() => {
    if (!hasShuffled || orderedQuotes.length < 2) return

    let fadeTimeout: number | undefined
    let showTimeout: number | undefined
    const interval = window.setInterval(() => {
      setIsVisible(false)
      fadeTimeout = window.setTimeout(() => {
        const activeQuotes = orderedQuotesRef.current
        const activeIndex = currentIndexRef.current

        if (activeIndex === activeQuotes.length - 1) {
          const nextOrder = shuffleQuotes(quotes)
          if (nextOrder[0] === activeQuotes[activeIndex]) {
            ;[nextOrder[0], nextOrder[1]] = [nextOrder[1], nextOrder[0]]
          }
          orderedQuotesRef.current = nextOrder
          currentIndexRef.current = 0
          setOrderedQuotes(nextOrder)
          setCurrentIndex(0)
        } else {
          currentIndexRef.current = activeIndex + 1
          setCurrentIndex(activeIndex + 1)
        }
        showTimeout = window.setTimeout(() => setIsVisible(true), 50)
      }, FADE_DURATION)
    }, ROTATION_INTERVAL)

    return () => {
      window.clearInterval(interval)
      if (fadeTimeout !== undefined) window.clearTimeout(fadeTimeout)
      if (showTimeout !== undefined) window.clearTimeout(showTimeout)
    }
  }, [hasShuffled, quotes])

  const quote = orderedQuotes[currentIndex]

  return (
    <section
      className="container mx-auto mb-12 px-4"
      aria-labelledby="community-quotes-heading"
    >
      <div className="mx-auto flex h-[300px] max-w-3xl flex-col overflow-hidden rounded-xl border border-cyan-300/15 bg-gradient-to-br from-[#26363b] via-[#24292d] to-[#2C2F33] p-5 shadow-xl shadow-black/20 sm:h-[280px] sm:p-7">
        <div className="text-center">
          <h2
            id="community-quotes-heading"
            className="text-xl font-bold text-white sm:text-2xl"
          >
            Community Voted Best Quotes
          </h2>
        </div>

        <div
          className={`mx-auto mt-4 flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center overflow-y-auto text-center transition-opacity duration-500 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-live="off"
          aria-atomic="true"
        >
          {quote ? (
            <>
              <Quote
                className="h-6 w-6 flex-shrink-0 text-cyan-300/80"
                aria-hidden="true"
              />
              <figure className="mt-3">
                <blockquote className="text-lg font-medium leading-relaxed text-gray-100 sm:text-xl">
                  “{quote.quote}”
                </blockquote>
                <figcaption className="mt-4 text-sm text-gray-300">
                  <span className="font-semibold text-cyan-200">
                    {quote.author ?? "Sharkcicle community"}
                  </span>
                  {quote.context && (
                    <span className="text-gray-400"> · {quote.context}</span>
                  )}
                </figcaption>
              </figure>
            </>
          ) : (
            <p className="max-w-xl leading-relaxed text-gray-300">
              We’re collecting favorite moments from around the server. Community
              quotes will appear here soon.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
