"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DiscIcon as Discord, Map, Book, LucideImage, BarChart3, CircleHelp, Radio } from "lucide-react"

interface NavigationProps {
  className?: string
}

export function Navigation({ className }: NavigationProps) {
  const [isTwitchLive, setIsTwitchLive] = useState(false)

  useEffect(() => {
    let isMounted = true

    const checkTwitchStatus = async () => {
      try {
        const response = await fetch("/api/twitch-status", { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Twitch status request failed with status ${response.status}`)
        }

        const status: { live?: unknown } = await response.json()
        if (typeof status.live !== "boolean") {
          throw new Error("Twitch status response did not contain a valid live status")
        }

        if (isMounted) {
          setIsTwitchLive(status.live)
        }
      } catch (error) {
        console.error("Twitch status check failed:", error)
      }
    }

    void checkTwitchStatus()
    const intervalId = window.setInterval(() => void checkTwitchStatus(), 60_000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const serverLinks = [
    {
      name: "Live Map",
      href: "http://play.sharkcicle.com:8751",
      icon: <Map className="h-5 w-5" />,
      external: true,
    },
    {
      name: "Wiki",
      href: "https://wiki.sharkcicle.com",
      icon: <Book className="h-5 w-5" />,
      external: true,
    },
    {
      name: "Statistics",
      href: "/statistics",
      icon: <BarChart3 className="h-5 w-5" />,
      external: false,
    },
    {
      name: "FAQ",
      href: "/faq",
      icon: <CircleHelp className="h-5 w-5" />,
      external: false,
    },
    {
      name: "Discord",
      href: "https://discord.com/invite/CYyPAxScfZ",
      icon: <Discord className="h-5 w-5" />,
      external: true,
    },
    {
      name: "Twitch",
      href: "https://www.twitch.tv/SharkyDice",
      icon: <Radio className="h-5 w-5" />,
      external: true,
    },
    {
      name: "Gallery",
      href: "/gallery",
      icon: <LucideImage className="h-5 w-5" />,
      external: false,
    },
  ]

  return (
    <nav className={`bg-[#2C2F33] py-2 sm:py-4 mb-8 ${className}`}>
      <div className="container mx-auto px-1 sm:px-4">
        <div className="flex justify-around sm:justify-center gap-0 sm:gap-4">
          {serverLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="min-w-0 flex-1 text-center sm:flex-none"
            >
              <Button
                variant="ghost"
                className="text-white hover:bg-[#34373C] hover:text-white flex w-full flex-col items-center p-1 sm:w-auto sm:p-2"
              >
                {link.icon}
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] sm:text-xs whitespace-nowrap">
                  {link.name}
                  {link.name === "Twitch" && isTwitchLive && (
                    <span
                      aria-label="Live now"
                      role="img"
                      className="h-2 w-2 rounded-full bg-red-500"
                    />
                  )}
                </span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
