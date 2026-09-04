import { NavLink } from 'react-router-dom'
import { NAV_ITEMS, canAccessScreen } from '../../../shared/permissions'
import type { UserRole } from '../../../shared/types'
import logo from '../assets/logo.png'

interface SidebarProps {
  role: UserRole
  username: string
  fullName: string
  onLogout: () => void
}

export function Sidebar({ role, username, fullName, onLogout }: SidebarProps): React.JSX.Element {
  const items = NAV_ITEMS.filter((item) => canAccessScreen(role, item.screen))

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-navy text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <img src={logo} alt="Topline Stores" className="h-12 w-12 rounded-full" />
        <div>
          <p className="text-sm font-bold tracking-wide">TOPLINE STORES</p>
          <p className="text-[11px] text-gold">Receipt System</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              [
                'mb-1 block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-gold text-navy-dark' : 'text-white/85 hover:bg-white/10'
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-semibold">{fullName}</p>
        <p className="text-xs capitalize text-white/60">
          {username} · {role}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
