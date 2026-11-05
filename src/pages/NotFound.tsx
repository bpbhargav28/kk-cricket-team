import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { LogoMark } from '../components/layout/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <LogoMark className="h-14 w-14" />
      <div>
        <p className="font-display text-6xl font-black text-coal-800">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-coal-100">
          Outside the boundary
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-coal-500">
          That page does not exist. It may have been a cancelled match, or a link that has moved.
        </p>
      </div>
      <Link to="/">
        <Button icon={<Compass className="h-4 w-4" />}>Back to dashboard</Button>
      </Link>
    </div>
  )
}
