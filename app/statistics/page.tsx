import { CoreProtectStats } from '@/components/coreprotect-stats'
import { Navigation } from '@/components/navigation'

export const metadata = {
  title: 'Server Statistics | Sharkcicle SMP',
  description: 'CoreProtect statistics for the Sharkcicle SMP Minecraft server',
}

export default function StatisticsPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8 space-y-8">
          <CoreProtectStats />
        </div>
      </main>
    </>
  )
}
