"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ImageModal } from "@/components/image-modal"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { Navigation } from "@/components/navigation"

export default function Gallery() {
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null)

  // Replace these with your actual server images
  const galleryImages = [
    { src: "/colosseum.png", alt: "Server Screenshot 1" },
    { src: "/abcmonument.png", alt: "Server Screenshot 2" },
    { src: "/damageinc.png", alt: "Server Screenshot 3" },
    { src: "/groupphoto1.png", alt: "Server Screenshot 4" },
    { src: "/msg.png", alt: "Server Screenshot 5" },
    { src: "/deadpool.png", alt: "Server Screenshot 6" },
  ]

  return (
    <div className="min-h-screen bg-[#1A1C1E] text-white">
      <header className="container mx-auto py-6 px-4">
        <Link href="/">
          <Button variant="ghost" className="text-white hover:bg-[#34373C]">
            <Home className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold text-center mt-4">Server Gallery</h1>
      </header>

      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleryImages.map((image, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage(image)}
            >
              <Image
                src={image.src || "/placeholder.svg"}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      </main>

      {selectedImage && (
        <ImageModal
          isOpen={true}
          onClose={() => setSelectedImage(null)}
          src={selectedImage.src || "/placeholder.svg"}
          alt={selectedImage.alt}
        />
      )}
    </div>
  )
}

