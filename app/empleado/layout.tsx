'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
            <span className="text-xs font-black text-slate-900">GW</span>
          </div>
          <span className="font-semibold">GWC Drywall</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/empleado/horas"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === '/empleado/horas' ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:text-white'}`}>
            Mis Horas
          </Link>
          <Link href="/empleado/facturas"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === '/empleado/facturas' ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:text-white'}`}>
            Mis Facturas
          </Link>
          <button onClick={logout} className="ml-3 text-sm text-slate-400 hover:text-white transition-colors">
            Salir
          </button>
        </nav>
      </header>
      <main className="max-w-2xl mx-auto p-6">{children}</main>
    </div>
  )
}
