import { redirect } from 'next/navigation'
import { CITY_MAPS } from '@/lib/city-maps'

export default function CityMapsIndex() {
  redirect(`/admin/city-maps/${CITY_MAPS[0].slug}`)
}
