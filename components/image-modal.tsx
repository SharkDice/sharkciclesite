"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import Image from "next/image"

interface ImageModalProps {
  isOpen: boolean
  onClose: () => void
  src: string
  alt: string
}

export function ImageModal({ isOpen, onClose, src, alt }: ImageModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={src || "/placeholder.svg"}
            alt={alt}
            className="max-w-full max-h-[95vh] w-auto h-auto object-contain"
            width={1920}
            height={1080}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

