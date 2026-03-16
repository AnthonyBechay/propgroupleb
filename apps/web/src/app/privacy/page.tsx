import Link from 'next/link'
import { Building2 } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1B4965] rounded-2xl mb-6">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-stone-600 mb-8">
            Our privacy policy is currently being prepared and will be available soon.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-[#1B4965] text-white font-medium rounded-lg hover:bg-[#163d55] transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
