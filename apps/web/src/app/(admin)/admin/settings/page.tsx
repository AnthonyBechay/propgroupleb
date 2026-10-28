'use client'

import Link from 'next/link'
import {
  Bell, Bot, ChevronRight, FileText, Gauge, KeyRound, Palette, User, Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessAdminPath } from '@/lib/permissions'
import { PageHeader } from '@/components/admin/ui/layout'

interface Card {
  href: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

/**
 * Settings as a set of cards, grouped by who the setting is for.
 *
 * It used to be three tabs (profile, password, logo), while the chat
 * assistant, notifications and AI spend each lived somewhere else — one in the
 * sidebar, one inside the inbox, one at the bottom of the pipeline overview.
 * Everything you set once and leave now starts here.
 */
const GROUPS: Array<{ label: string; cards: Card[] }> = [
  {
    label: 'You',
    cards: [
      { href: '/admin/settings/profile', title: 'Profile', description: 'Your name, phone and country.', icon: User },
      { href: '/admin/settings/security', title: 'Password', description: 'Change the password you sign in with.', icon: KeyRound },
      { href: '/admin/settings/notifications', title: 'Notifications', description: 'Get a notification on your phone when a client writes.', icon: Bell },
    ],
  },
  {
    label: 'Chats and AI',
    cards: [
      { href: '/admin/settings/assistant', title: 'Chat assistant', description: 'Who it answers on WhatsApp and Instagram, what it recommends, and its saved answers.', icon: Bot },
      { href: '/admin/settings/ai-usage', title: 'AI usage and budget', description: 'What AI has cost today and this month, and the limit where it stops.', icon: Gauge },
    ],
  },
  {
    label: 'Websites',
    cards: [
      { href: '/admin/content', title: 'Website content', description: 'Text and images on the public pages.', icon: FileText },
      { href: '/admin/settings/branding', title: 'Branding', description: 'The logo on exported property sheets and investor documents.', icon: Palette },
    ],
  },
  {
    label: 'Team',
    cards: [
      { href: '/admin/users', title: 'Users and roles', description: 'Who can sign in to the back office, and what each person can see.', icon: Users },
    ],
  },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const groups = GROUPS
    .map((g) => ({ ...g, cards: g.cards.filter((c) => canAccessAdminPath(user?.role, c.href)) }))
    .filter((g) => g.cards.length > 0)

  return (
    <div className="space-y-7">
      <PageHeader title="Settings" description="Everything you set once and leave." />
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{g.label}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group flex min-h-24 items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-white">
                  <c.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{c.title}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-500">{c.description}</span>
                </span>
                <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
