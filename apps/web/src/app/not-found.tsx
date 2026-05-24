import Link from 'next/link'
import { Building2 } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-2xl mb-8 shadow-lg">
          <Building2 className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-7xl font-black text-slate-900 mb-4">
          404
        </h1>

        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          Page Not Found
        </h2>

        <p className="text-slate-600 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-md hover:shadow-lg"
          >
            Go Home
          </Link>
          <Link
            href="/properties"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Browse Properties
          </Link>
        </div>
      </div>
    </div>
  )
}
