import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const slideshowDir = path.join(process.cwd(), 'public', 'slideshow')
    
    if (!fs.existsSync(slideshowDir)) {
      fs.mkdirSync(slideshowDir, { recursive: true })
    }

    const files = fs.readdirSync(slideshowDir)
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    const imageFiles = files
      .filter((file) =>
        imageExtensions.includes(path.extname(file).toLowerCase())
      )
    const unnumberedImages = imageFiles.filter((file) => !/^\d+-/.test(file))

    if (unnumberedImages.length > 0) {
      throw new Error(
        `Slideshow image filenames must start with a number and a hyphen: ${unnumberedImages.join(', ')}`
      )
    }

    const images = imageFiles
      .sort(
        (a, b) =>
          Number(a.split('-')[0]) - Number(b.split('-')[0]) ||
          a.localeCompare(b)
      )
      .map((file) => `/slideshow/${file}`)

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Error reading slideshow images:', error)
    return NextResponse.json({
      images: ['/bodyimage.png'],
      error: 'Failed to read slideshow directory',
    })
  }
}
