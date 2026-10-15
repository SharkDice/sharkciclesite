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
  }, [slideshow.images.length])

  if (!mounted || slideshow.images.length === 0) {
    return null
  }

  const nextIndex = (slideshow.currentIndex + 1) % slideshow.images.length

  return (
    <div className="relative aspect-[21/12] max-w-6xl mx-auto overflow-hidden rounded-lg">
      <style>{`
        @keyframes crossFade {
          0% { opacity: 1; }
          45% { opacity: 1; }
          55% { opacity: 0; }
          100% { opacity: 0; }
        }
        .fade-out-image {
          animation: crossFade 7s ease-in-out infinite;
        }
      `}</style>

      {/* Base image - always present */}
      <div className="absolute inset-0">
        <Image
          src={slideshow.images[slideshow.currentIndex]}
          alt="Base image"
          fill
          className="object-cover"
          priority
          key={`base-${slideshow.currentIndex}`}
        />
      </div>

      {/* Overlay image - fades in */}
      <div className="absolute inset-0 fade-out-image">
        <Image
          src={slideshow.images[nextIndex]}
          alt="Next image"
          fill
          className="object-cover"
          priority
          key={`overlay-${nextIndex}`}
        />
      </div>

      {slideshow.images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
          {slideshow.images.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setSlideshow({
                  images: slideshow.images,
                  currentIndex: index,
                })
              }}
              className={`w-2 h-2 rounded-full transition-all ${
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
