import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/players', label: 'Players' },
  { to: '/compare', label: 'Compare' },
  { to: '/matchup', label: 'Matchup' },
  { to: '/predict', label: 'Predictions' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-page text-ink-primary">
      <header className="sticky top-0 z-20 border-b border-border bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-series-1 text-sm font-bold text-page">
              Q
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Court<span className="text-series-1">IQ</span>
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-surface-2 text-ink-primary'
                      : 'text-ink-secondary hover:bg-surface-1 hover:text-ink-primary'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
