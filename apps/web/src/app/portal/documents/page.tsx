'use client'

import { FileText } from 'lucide-react'

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="pg-card p-12">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Documents
            </h1>
            <p className="text-slate-600">
              Securely store and manage your investment documents. Your documents will appear here once your investment journey begins.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
