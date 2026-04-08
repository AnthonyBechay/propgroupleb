import { Loader2 } from 'lucide-react'

export default function PropertiesLoading() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative py-6 sm:py-8 bg-[#1B3A5C] text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="h-8 w-64 bg-white/10 rounded-lg mx-auto mb-2 animate-pulse" />
          <div className="h-4 w-48 bg-white/10 rounded mx-auto animate-pulse" />
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl h-[380px] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
