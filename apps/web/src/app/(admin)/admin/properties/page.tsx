import { PropertyTable } from '@/components/admin/PropertyTable'
import { CreatePropertyModal } from '@/components/admin/CreatePropertyModal'
import { Button } from '@/components/ui/button'
import { Plus, Building2 } from 'lucide-react'
import { Property } from '@/lib/types/api'

export default async function AdminPropertiesPage() {
  // Layout already handles authentication, no need to check again
  let properties: any[] = []
  let developers: any[] = []
  let locationGuides: any[] = []

  try {
    console.log('[Admin Properties] Fetching properties from API...')

    // Fetch from API instead of direct database access
    const { normalizeApiUrl } = await import('@/lib/utils/api-url')
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

    // Fetch all properties
    const propertiesResponse = await fetch(`${apiUrl}/api/properties?limit=1000`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (propertiesResponse.ok) {
      const propertiesData = await propertiesResponse.json()
      if (propertiesData.success && propertiesData.data) {
        properties = propertiesData.data
        console.log(`[Admin Properties] Found ${properties.length} properties`)
      }
    } else {
      console.error('[Admin Properties] Failed to fetch properties:', propertiesResponse.status)
    }

    // Fetch developers and location guides (we'll need to create these API endpoints or use mock data)
    // For now, using empty arrays - you can add API endpoints for these later
    developers = []
    locationGuides = []

    console.log(`[Admin Properties] Found ${developers.length} developers and ${locationGuides.length} location guides`)
  } catch (error) {
    console.error('[Admin Properties] Error fetching properties data:', error)
    console.error('[Admin Properties] Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    })
    // Return empty arrays if API fetch fails
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Properties
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage all properties in your platform. Create, edit, and delete property listings.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreatePropertyModal
            developers={developers}
            locationGuides={locationGuides}
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </CreatePropertyModal>
        </div>
      </div>

      <div className="mt-8">
        {properties.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No properties yet</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first property to the platform.</p>
            <CreatePropertyModal
              developers={developers}
              locationGuides={locationGuides}
            >
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Property
              </Button>
            </CreatePropertyModal>
          </div>
        ) : (
          <PropertyTable properties={properties} />
        )}
      </div>
    </div>
  )
}
