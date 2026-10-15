'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export function ImageSlideshow() {
  const [images, setImages] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const fetchImages = async () => {
      try {
        const response = await fetch('/api/slideshow-images')
        const data = await response.json()
        setImages(data.images || ['/bodyimage.png'])
      } catch (err) {
        console.error('Failed to load slideshow images:', err)
        setImages(['/bodyimage.png'])
      }
    }

    fetchImages()
  }, [])

  if (!mounted || images.length === 0) {
    return null
  }

  // Just show the first image, no animation
  return (
    <div className="relative aspect-[21/12] max-w-6xl mx-auto overflow-hidden rounded-lg">
      <Image
        src={images[0]}
        alt="Slideshow"
        fill
        className="object-cover"
        priority
      />
    </div>
  )
}
