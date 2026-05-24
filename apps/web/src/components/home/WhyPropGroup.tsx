import { Home, Key, TrendingUp, Building2 } from 'lucide-react'
import Link from 'next/link'

const SERVICES = [
  {
    icon: Home,
    title: 'Buy',
    heading: 'Find Your Dream Property',
    description:
      'Browse curated listings with expert support from search to keys.',
  },
  {
    icon: Key,
    title: 'Rent',
    heading: 'Rent with Confidence',
    description:
      'Discover verified rental listings across Lebanon with transparent pricing.',
  },
  {
    icon: TrendingUp,
    title: 'Sell',
    heading: 'Sell Through Us',
    description:
      "List your property with Lebanon's leading brokerage and reach serious buyers.",
  },
  {
    icon: Building2,
    title: 'Manage',
    heading: 'Property Management',
    description:
      'Let us handle tenants, maintenance, and rent collection for your portfolio.',
  },
]

export function WhyPropGroup() {
  return (
    <section className="py-12 sm:py-16 bg-slate-50 border-t border-slate-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            How We Help
          </h2>
          <p className="text-slate-500 text-sm">
            Full-service real estate brokerage — whatever your goal.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {SERVICES.map((service) => {
            const Icon = service.icon
            return (
              <Link
                key={service.title}
                href="/get-started"
                className="group bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-200 mb-3 group-hover:bg-slate-300 transition-colors">
                  <Icon className="w-5 h-5 text-slate-700" />
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {service.title}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  {service.heading}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {service.description}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
