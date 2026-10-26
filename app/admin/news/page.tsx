import { NewsManager } from "@/components/news-manager"

export const metadata = {
  title: "News Editor | Sharkcicle",
}

export default function NewsAdminPage() {
  return (
    <main className="min-h-screen bg-[#1A1C1E] px-4 py-10 text-white">
      <NewsManager />
    </main>
  )
}
