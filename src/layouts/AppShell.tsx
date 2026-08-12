import { Outlet } from 'react-router-dom'

import Footer from '@/components/layout/Footer'
import Header from '@/components/layout/Header'
import { ChatWidget } from '@/features/chat/ChatWidget'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 2xl:px-6">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}