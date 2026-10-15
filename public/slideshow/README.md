# Image Slideshow Setup

## How to Add Images to the Slideshow

1. Place your images in the `public/slideshow/` folder
2. Images are automatically detected and displayed in alphabetical order
3. Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

## Naming Convention (Optional)

To control the order images appear, you can name them with numbers:
- `1.png` (first image)
- `2.png` (second image)
- `3.png` (third image)
- etc.

Or with descriptive names that sort alphabetically:
- `a_screenshot.png`
- `b_build.png`
- `c_landscape.png`

## Features

- **Auto-rotation**: Images change every 5 seconds
- **Fade effect**: Smooth fade transitions between images
- **Indicators**: Clickable dots at the bottom to jump to any image
- **Responsive**: Images scale to fit the 21:12 aspect ratio

## Example

To have 3 images in your slideshow:
1. `public/slideshow/1.png`
2. `public/slideshow/2.png`
3. `public/slideshow/3.png`

The slideshow will automatically load all images and cycle through them!

## Fallback

If no images are found in the slideshow folder, it will default to showing the main `bodyimage.png`.
