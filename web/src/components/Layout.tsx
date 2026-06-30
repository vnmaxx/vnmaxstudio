import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar, { MobileTopBar, MobileTabBar, Drawer } from './Sidebar'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <MobileTopBar onMenu={() => setDrawerOpen(true)} />
        <Outlet />
      </div>
      <MobileTabBar />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
