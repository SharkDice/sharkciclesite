'use client'

import { useEffect, useState } from 'react'

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
    <div style={{
      position: 'relative',
      aspectRatio: '21 / 12',
      maxWidth: '42rem',
      margin: '0 auto',
      overflow: 'hidden',
      borderRadius: '0.5rem',
      backgroundColor: '#000',
    }}>
      {/* Previous image - fading out */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url('${slideshow.images[previousIndex]}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0,
          transition: 'opacity 2s ease-in-out',
          zIndex: 1,
        }}
      />
      
      {/* Current image - fading in */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url('${slideshow.images[slideshow.currentIndex]}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 1,
          transition: 'opacity 2s ease-in-out',
          zIndex: 2,
        }}
      />

      {slideshow.images.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 10,
        }}>
          {slideshow.images.map((_, index) => (
            <button
              key={`dot-${index}`}
              onClick={() => handleDotClick(index)}
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: index === slideshow.currentIndex ? '#ffffff' : '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (index !== slideshow.currentIndex) {
                  e.currentTarget.style.backgroundColor = '#d1d5db'
                }
              }}
              onMouseLeave={(e) => {
                if (index !== slideshow.currentIndex) {
                  e.currentTarget.style.backgroundColor = '#9ca3af'
                }
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
