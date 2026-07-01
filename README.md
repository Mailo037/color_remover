# Color Remover

A modern, fast, and fully in-browser tool to effortlessly remove backgrounds, extract objects, and add effects to your images. Built with React, Vite, and Tailwind CSS.

![Color Remover Preview](public/android-chrome-512x512.png)

## Features

- **Intelligent Color Removal:** Pick any color to make it transparent using an advanced color-distance algorithm.
- **100% Local Processing:** Uses Web Workers to process images directly in your browser. No images are ever uploaded to a server!
- **Responsive & Customizable Layout:** Pin the settings panel to the left, right, top, or bottom. Adapts perfectly to any screen size.
- **Advanced Edge Smoothing:** Creates soft transitions for clean, professional edges without pixelated borders.
- **Multi-Color Target:** Select and remove multiple different colors at once.
- **Auto-Crop:** Automatically trims empty transparent space around your subject.
- **Modern Formats:** Download your processed images as high-quality PNGs or compressed WebP files.

## Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Mailo037/color_remover.git
   ```

2. Navigate into the project directory:
   ```bash
   cd color_remover
   ```

3. Install the dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and visit `http://localhost:5175`.

## Technologies Used

- **React** - UI Library
- **Vite** - Build Tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Web Workers** - Heavy image processing

## Author

Made by [Mailo037](https://github.com/Mailo037).
