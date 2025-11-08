import {
  FileText,
  Upload,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DocumentsPage() {
  // Layout already handles authentication

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Document Management
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage and organize all platform documents, templates, and guides.
          </p>
        </div>
      </div>

      {/* Coming Soon State */}
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
          <AlertCircle className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Document Management Coming Soon</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          This feature is currently under development. You'll be able to upload, organize, and manage documents for your platform here.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <div className="bg-gray-50 rounded-lg p-4 flex-1 max-w-xs">
            <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Upload Documents</h4>
            <p className="text-sm text-gray-600">Store and manage property documents, contracts, and guides</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex-1 max-w-xs">
            <FileText className="h-6 w-6 text-gray-400 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Organize Files</h4>
            <p className="text-sm text-gray-600">Categorize and search through your document library</p>
          </div>
        </div>
      </div>
    </div>
  )
}
