'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const FADE_DURATION = 1500 // Duration of fade transition in ms
const SLIDE_DISPLAY_DURATION = 10000 // How long each image displays in ms

export function ImageSlideshow() {
  const [images, setImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState(1)
  const [mounted, setMounted] = useState(false)
  const [opacity, setOpacity] = useState(1)

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

  // Handle slideshow rotation
  useEffect(() => {
    if (images.length <= 1) return

    const interval = setInterval(() => {
      setOpacity(0)
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
        setNextIndex((prev) => (prev + 1) % images.length)
      }, FADE_DURATION)
      
      setTimeout(() => {
        setOpacity(1)
      }, FADE_DURATION + 50)
    }, SLIDE_DISPLAY_DURATION)

    return () => clearInterval(interval)
  }, [images.length])

  if (!mounted || images.length === 0) {
    return null
  }

  return (
    <div className="relative aspect-[21/12] max-w-6xl mx-auto overflow-hidden rounded-lg">
      {/* Current image with fade transition */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
        style={{ opacity }}
      >
        <Image
          src={images[currentIndex]}
          alt="Slideshow"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  )
}
