import { LogOut } from 'lucide-react'
import { InstallButton } from '../app/InstallButton'
import { COPY } from '../lib/copy'
import { IconButton } from '../ui/Primitives'
import { NotificationCenter } from './NotificationCenter'

export function HeaderUtilities({ onSignOut }: { onSignOut: () => void }) {
  return <div className="topbar-actions"><InstallButton /><NotificationCenter /><IconButton label={COPY.shell.signOut} onClick={onSignOut}><LogOut aria-hidden="true" size={20} /></IconButton></div>
}
