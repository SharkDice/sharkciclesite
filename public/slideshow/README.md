# Image Slideshow Setup

## How to Add Images to the Slideshow

1. Place your images in the `public/slideshow/` folder
2. Images are automatically detected and displayed by their numeric filename prefix
3. Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

## Naming Convention

Start each filename with its order number and a hyphen. For example:
- `01-screenshot.png` (first image)
- `02-build.jpg` (second image)
- `03-landscape.png` (third image)

To rearrange the slideshow, change the number prefixes. Use leading zeroes to
keep filenames easy to scan; images are sorted numerically, not alphabetically.

## Features

- **Auto-rotation**: Images change every 5 seconds
- **Fade effect**: Smooth fade transitions between images
- **Indicators**: Clickable dots at the bottom to jump to any image
- **Responsive**: Images scale to fit the 21:12 aspect ratio

## Example

To have 3 images in your slideshow:
1. `public/slideshow/01-screenshot.png`
2. `public/slideshow/02-build.png`
3. `public/slideshow/03-landscape.png`

The slideshow will automatically load all images and cycle through them!

## Fallback

If no images are found in the slideshow folder, it will default to showing the main `bodyimage.png`.
