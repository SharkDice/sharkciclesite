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
    const images = files
      .filter((file) =>
        imageExtensions.includes(path.extname(file).toLowerCase())
      )
      .sort()
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
