import {
  CalendarDays,
  History,
  LayoutDashboard,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  /** Shorter label for the mobile bottom bar. */
  short: string
  icon: LucideIcon
  adminOnly?: boolean
  /** Also highlight for these path prefixes. */
  matches?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  {
    to: '/matches',
    label: 'Matches',
    short: 'Matches',
    icon: CalendarDays,
    matches: ['/matches', '/create-match'],
  },
  { to: '/payments', label: 'Payments', short: 'Payments', icon: Wallet },
  { to: '/history', label: 'History', short: 'History', icon: History },
  { to: '/players', label: 'Players', short: 'Players', icon: Users, adminOnly: true },
]

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/'
  const prefixes = item.matches ?? [item.to]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
