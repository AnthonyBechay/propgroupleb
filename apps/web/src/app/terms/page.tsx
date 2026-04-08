import Link from 'next/link'
import { Building2 } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1B3A5C] rounded-2xl mb-6">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Terms of Service
          </h1>
          <p className="text-slate-600 mb-8">
            Our terms of service are currently being prepared and will be available soon.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-[#1B3A5C] text-white font-medium rounded-lg hover:bg-[#152D4A] transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
