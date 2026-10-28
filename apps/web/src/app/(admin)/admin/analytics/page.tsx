import { AnalyticsClient } from './AnalyticsClient'

type Market = 'all' | 'LEBANON' | 'INTERNATIONAL'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const asked = (sp.market ?? '').toUpperCase()
  const market: Market = asked === 'LEBANON' || asked === 'INTERNATIONAL' ? asked : 'all'
  // Everything is fetched in the browser: the login cookie belongs to the API's
  // own domain, so a fetch from this server would arrive signed out.
  return <AnalyticsClient market={market} />
}
