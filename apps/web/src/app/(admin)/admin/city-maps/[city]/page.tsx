import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/ui/layout'
import { CITY_MAPS, cityMap } from '@/lib/city-maps'
import { CityMapView } from './CityMapView'

/**
 * "Understand <city>" — the city explained on a map, for whoever is selling it.
 * The data is in `lib/city-maps`; this page knows nothing about any one city.
 */
export default async function CityMapPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params
  const city = cityMap(slug)
  if (!city) notFound()

  return (
    <div>
      <PageHeader
        title={`Understand ${city.city}`}
        description={`${city.country} — the regions, what each one is, where to invest and where not to.`}
        actions={
          CITY_MAPS.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {CITY_MAPS.map((c) => (
                <Link
                  key={c.slug}
                  href={`/admin/city-maps/${c.slug}`}
                  className={
                    c.slug === city.slug
                      ? 'inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-3.5 text-sm font-medium text-white sm:min-h-9'
                      : 'inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-9'
                  }
                >
                  {c.city}
                </Link>
              ))}
            </div>
          ) : undefined
        }
      />
      <CityMapView city={city} />
    </div>
  )
}
