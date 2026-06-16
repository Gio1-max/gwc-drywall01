'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/proyectos', label: 'Proyectos', icon: '🏠' },
  { href: '/admin/empleados', label: 'Empleados', icon: '👷' },
  { href: '/admin/horas', label: 'Horas', icon: '⏰' },
  { href: '/admin/facturas', label: 'Facturas', icon: '🧾' },
  { href: '/admin/finanzas', label: 'Finanzas', icon: '💰' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuAbierto, setMenuAbierto] = useState(false)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 bg-slate-800 text-white flex-col shrink-0">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-400 rounded-lg flex items-center justify-center">
              <span className="text-sm font-black text-slate-900">GW</span>
            </div>
            <div>
              <p className="font-bold text-sm">GWC Drywall</p>
              <p className="text-xs text-slate-400">Administrador</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href) ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:bg-slate-700'
              }`}>
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700">
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Header mobile */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
              <span className="text-xs font-black text-slate-900">GW</span>
            </div>
            <span className="font-semibold text-sm">GWC Drywall</span>
          </div>
          <button onClick={() => setMenuAbierto(!menuAbierto)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors">
            <div className="space-y-1">
              <span className={`block w-5 h-0.5 bg-white transition-transform ${menuAbierto ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white transition-opacity ${menuAbierto ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white transition-transform ${menuAbierto ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </div>
          </button>
        </header>

        {/* Menu mobile desplegable */}
        {menuAbierto && (
          <div className="md:hidden fixed inset-0 z-10 top-14">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAbierto(false)} />
            <nav className="absolute top-0 right-0 w-64 h-full bg-slate-800 p-4 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => setMenuAbierto(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href) ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:bg-slate-700'
                  }`}>
                  <span className="text-lg">{item.icon}</span>{item.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-slate-700 mt-4">
                <button onClick={logout}
                  className="w-full text-left px-3 py-3 text-sm text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700">
                  Cerrar Sesión
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* Contenido */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
