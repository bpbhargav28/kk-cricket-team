import { FlaskConical } from 'lucide-react'
import { DEMO_MODE } from '../lib/constants'

/**
 * Dev-only marker, shown when VITE_ENABLE_DEMO_DATA=true in a `npm run dev`
 * build. It makes it obvious that the data on screen may be seeded, and points
 * at the seed script. `DEMO_MODE` is gated on `import.meta.env.DEV`, so this
 * component and its branch are dropped from production bundles entirely.
 */
export function DemoBadge() {
  if (!DEMO_MODE) return null

  return (
    <div
      className="fixed left-3 top-3 z-50 flex items-center gap-1.5 rounded-full border border-amber-700/60 bg-amber-950/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 shadow-lg backdrop-blur lg:left-auto lg:right-3"
      title="Demo mode is on. Seed data comes from supabase/seed/demo_data.sql."
    >
      <FlaskConical className="h-3 w-3" />
      Demo data
    </div>
  )
}
