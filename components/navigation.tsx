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
      icon: <Map className="h-4 w-4" />,
      external: true,
    },
    {
      name: "Wiki",
      href: "https://wiki.sharkcicle.com",
      icon: <Book className="h-4 w-4" />,
      external: true,
    },
    {
      name: "Discord",
      href: "https://discord.com/invite/UNBQwEdaaP",
      icon: <Discord className="h-4 w-4" />,
      external: true,
    },
    {
      name: "Gallery",
      href: "/gallery",
      icon: <LucideImage className="h-4 w-4" />,
      external: false,
    },
  ]

  return (
    <nav className={`bg-[#2C2F33] py-4 mb-8 ${className}`}>
      <div className="container mx-auto px-4 overflow-x-auto">
        <div className="flex flex-nowrap justify-start md:justify-center gap-4 pb-2 md:pb-0">
          {serverLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
            >
              <Button
                variant="ghost"
                className="text-white hover:bg-[#34373C] hover:text-white whitespace-nowrap px-2 md:px-4"
              >
                {link.icon}
                <span className="ml-2 text-xs md:text-sm">{link.name}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

