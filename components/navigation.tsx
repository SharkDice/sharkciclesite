"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DiscIcon as Discord, Map, Book, LucideImage } from "lucide-react"

interface NavigationProps {
  className?: string
}

export function Navigation({ className }: NavigationProps) {
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
      name: "Discord",
      href: "https://discord.com/invite/UNBQwEdaaP",
      icon: <Discord className="h-5 w-5" />,
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
              className="text-center"
            >
              <Button
                variant="ghost"
                className="text-white hover:bg-[#34373C] hover:text-white flex flex-col items-center p-1 sm:p-2 w-[70px] sm:w-auto"
              >
                {link.icon}
                <span className="mt-1 text-[10px] sm:text-xs whitespace-nowrap">{link.name}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

