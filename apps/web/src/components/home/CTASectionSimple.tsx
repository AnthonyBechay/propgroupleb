import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function CTASectionSimple() {
  return (
    <section className="relative py-16 sm:py-20 bg-zinc-900 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-6">
            Ready to Find Your Property?
          </h2>

          <p className="text-lg sm:text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
            Lebanon's trusted brokerage for buying, renting, selling, and managing real estate.
          </p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-10 text-sm text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>No hidden fees</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Expert local agents</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>End-to-end support</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/listings">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-10 text-base font-bold bg-white hover:bg-zinc-100 text-zinc-900 rounded-xl shadow-xl transition-all"
              >
                <span className="flex items-center gap-2">
                  Browse All Properties
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Button>
            </Link>

            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-14 px-10 text-base font-semibold bg-white/5 border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 rounded-xl backdrop-blur-sm transition-all"
              >
                Talk to an Agent
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
