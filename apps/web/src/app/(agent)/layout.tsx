import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // In a real app, verify the user is an agent via API or JWT
  // For now, we'll let the middleware handle this

  return (
    <div className="min-h-screen bg-stone-50">
      {children}
    </div>
  )
}
