import { EventsManager } from "@/components/events-manager"

export const metadata = {
  title: "Events Editor | Sharkcicle",
}

export default function EventsAdminPage() {
  return (
    <main className="min-h-screen bg-[#1A1C1E] px-4 py-10 text-white">
      <EventsManager />
    </main>
  )
}
