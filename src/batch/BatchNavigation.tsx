import { Home, Images, Landmark, UserRound, UsersRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navigationFor } from './navigation'
import type { MembershipRole } from '../lib/types'

const icons = { '/home': Home, '/houses': UsersRound, '/reunion': Landmark, '/memories': Images, '/account': UserRound }

export function DesktopNavigation({ role }: { role?: MembershipRole }) {
  return <nav className="desktop-nav" aria-label="Batch navigation">{navigationFor(role).map((link) => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}</nav>
}

export function MobileNavigation({ role }: { role?: MembershipRole }) {
  return <nav className="bottom-nav" aria-label="Batch navigation">{navigationFor(role).map((link) => {
    const Icon = icons[link.to as keyof typeof icons]
    return <NavLink key={link.to} className="nav-item" to={link.to}><Icon aria-hidden="true" size={20} strokeWidth={2.25} /><span>{link.label}</span></NavLink>
  })}</nav>
}
