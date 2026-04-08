import { Loader2 } from 'lucide-react'

export default function PortalLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3A5C] mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading portal...</p>
      </div>
    </div>
  )
}
