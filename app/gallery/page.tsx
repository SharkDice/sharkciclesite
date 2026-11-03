import { readdir } from "node:fs/promises"
import path from "node:path"
import GalleryClient from "./gallery-client"

const imageDescriptions: Record<string, string> = {
  "colosseum.png": "Colosseum",
  "abcmonument.png": "ABC monument",
  "damageinc.png": "Damage Inc. build",
  "groupphoto1.png": "Server community group photo",
  "msg.png": "Server build",
  "deadpool.png": "Deadpool build",
  "abcmonument2.jpeg": "ABC monument",
  "colosseum2.jpeg": "Colosseum",
  "damageinc.jpeg": "Damage Inc. build",
  "entertainmentdistrict.jpeg": "Entertainment district",
  "grimhorn.jpeg": "Grimhorn build",
  "horsestatue.jpeg": "Horse statue",
  "newtyton.jpeg": "New Tyton",
  "sharkciclebar.jpeg": "Sharkcicle bar",
  "shoppingisland.jpeg": "Shopping island",
  "spawnlogo.jpeg": "Server spawn logo",
  "spawnlogoclose.jpeg": "Close-up of the server spawn logo",
  "sunset.jpeg": "Sunset",
  "vidalia.jpeg": "Vidalia",
  "wizardtower.jpeg": "Wizard tower",
}

export default async function Gallery() {
  const galleryDirectory = path.join(process.cwd(), "public", "gallery")
  const files = await readdir(galleryDirectory)
  const imageFiles = files.filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file))

  for (const file of imageFiles) {
    if (!/^\d+-/.test(file)) {
      throw new Error(`Gallery image "${file}" must start with a number and a hyphen.`)
    }
  }

  const galleryImages = imageFiles
    .sort((a, b) => {
      const orderDifference = Number(a.match(/^\d+/)?.[0]) - Number(b.match(/^\d+/)?.[0])
      return orderDifference || a.localeCompare(b)
    })
    .map((file) => {
      const originalName = file.replace(/^\d+-/, "")
      const fallbackAlt = originalName
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")

      return {
        src: `/gallery/${encodeURIComponent(file)}`,
        alt: imageDescriptions[originalName] ?? fallbackAlt,
      }
    })

  return <GalleryClient galleryImages={galleryImages} />
}
