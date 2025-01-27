import Image from "next/image"
import { Navigation } from "@/components/navigation"

export default function MinecraftServer() {
  return (
    <div className="min-h-screen bg-[#1A1C1E] text-white">
      {/* Header with Logo */}
      <header className="container mx-auto pt-8 pb-4 px-4">
        <div className="flex justify-center">
          <Image
            src="/placeholder.svg"
            alt="Server Logo"
            width={400}
            height={120}
            className="h-[120px] w-auto"
            priority
          />
        </div>
      </header>

      <Navigation />

      {/* Community Description */}
      <section className="container mx-auto px-4 mb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-6">Welcome to Sharkcicle!</h1>
          <p className="text-lg text-gray-300">
            Sharkcicle Smp is a thriving 1.21 Minecraft server, established on December 4th, 2021.
            Our mission is to foster collaboration and collective achievement, transcending individual
            efforts. With cherished memories, valued friendships, and endless enjoyment, our commitment
            is unwavering; the server will persist indefinitely, ensuring your creations endure. Join our
            vibrant community through the Discord link above and be part of something extraordinary!
          </p>
        </div>
      </section>

      {/* Feature Image */}
      <section className="container mx-auto px-4 mb-16">
        <div className="relative aspect-[21/9] max-w-6xl mx-auto overflow-hidden rounded-lg">
          <Image
            src="/placeholder.svg"
            alt="Server Feature"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* Server Information */}
      <section className="container mx-auto px-4 mb-16">
        <div className="max-w-4xl mx-auto bg-[#2C2F33] rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-6">About Our Server</h2>
          <div className="space-y-6 text-gray-300">
            <p>
              Join Sharkcicle Smp today and become part of our lively community! Discover a friendly
              environment where players collaborate and forge lasting friendships. Whether you enjoy survival
              challenges or unleashing your creativity in creative mode, our server offers the best of both
              worlds. With a carefully curated selection of quality of life plugins, we enhance your gameplay
              experience, ensuring smooth and enjoyable sessions. Don't miss out on the fun - join our Discord
              to connect with like-minded individuals and embark on new adventures together!
            </p>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-white">Key Features:</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Survival & creative server to plan your builds!</li>
                <li>Friendly community full of silly hooligans!</li>
                <li>Regular events and competitions!</li>
                <li>Custom quality of life plugins and features!</li>
                <li>Player-driven diamond economy!</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2C2F33] py-6">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>Connect with us on Discord to join our community!</p>
          <p>Application approval required to join.</p>
          <p className="mt-2">Server IP: play.sharkcicle.com</p>
        </div>
      </footer>
    </div>
  )
}

