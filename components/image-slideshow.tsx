'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface ImageSlideshow {
  images: string[]
  currentIndex: number
}

export function ImageSlideshow() {
  const [slideshow, setSlideshow] = useState<ImageSlideshow>({
    images: [],
    currentIndex: 0,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const fetchImages = async () => {
      try {
        const response = await fetch('/api/slideshow-images')
        const data = await response.json()
        setSlideshow({
          images: data.images || [],
          currentIndex: 0,
        })
      } catch (err) {
        console.error('Failed to load slideshow images:', err)
        setSlideshow({
          images: ['/bodyimage.png'],
          currentIndex: 0,
        })
      }
    }

    fetchImages()
  }, [])

  useEffect(() => {
    if (slideshow.images.length <= 1) return

    const timer = setInterval(() => {
      setSlideshow((prev) => ({
        ...prev,
        currentIndex: (prev.currentIndex + 1) % prev.images.length,
      }))
    }, 7000)

    return () => clearInterval(timer)
  }, [slideshow.images])

  if (!mounted || slideshow.images.length === 0) {
    return null
  }

  const handleDotClick = (index: number) => {
    setSlideshow({
      images: slideshow.images,
      currentIndex: index,
    })
  }

  const previousIndex = (slideshow.currentIndex - 1 + slideshow.images.length) % slideshow.images.length

  return (
    <div className="relative aspect-[21/12] max-w-6xl mx-auto overflow-hidden rounded-lg">
      {/* Previous image fading out */}
      <div className="absolute inset-0 animate-fadeOut">
        <Image
          src={slideshow.images[previousIndex]}
          alt={`Slide ${previousIndex + 1}`}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Current image fading in */}
      <div className="absolute inset-0 animate-fadeIn">
        <Image
          src={slideshow.images[slideshow.currentIndex]}
          alt={`Slide ${slideshow.currentIndex + 1}`}
          fill
          className="object-cover"
          priority
        />
      </div>

      {slideshow.images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
          {slideshow.images.map((_, index) => (
            <button
              key={`dot-${index}`}
              onClick={() => handleDotClick(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === slideshow.currentIndex
                  ? 'bg-white w-6'
                  : 'bg-gray-400 hover:bg-gray-300'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
