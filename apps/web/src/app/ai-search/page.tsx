import { AIPropertySearch } from '@/components/ai/AIPropertySearch'
import { Bot, Sparkles, TrendingUp, Shield, Zap } from 'lucide-react'

export const metadata = {
  title: 'AI Property Search',
  description: 'Find your perfect investment property using our AI-powered search assistant',
}

export default function AISearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Compact Hero Section */}
      <section className="relative py-6 sm:py-8 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold mb-3">
              <Bot className="w-3.5 h-3.5" />
              AI-POWERED SEARCH
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
              Find Your Perfect Property with AI
            </h1>
            <p className="text-sm sm:text-base text-white/90 mb-4">
              Describe what you're looking for in plain English
            </p>
          </div>
        </div>
      </section>

      {/* AI Search Interface - More Prominent */}
      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <AIPropertySearch variant="page" />

            {/* Example searches - More Compact */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                Example Searches
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                      "I need a 2-3 bedroom property in Cyprus under $350,000"
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                      "Show me properties with the highest ROI in Greece"
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                      "Golden Visa eligible properties between $250k and $500k"
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                      "I want a new build apartment with good rental yield"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* How it works - Compact */}
            <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                How It Works
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-base font-bold">
                    1
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">
                    Describe Your Needs
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs">
                    Type in natural language
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-base font-bold">
                    2
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">
                    AI Analyzes Request
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs">
                    Smart filter conversion
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-pink-600 to-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-base font-bold">
                    3
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">
                    Get Perfect Matches
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs">
                    Instant results with insights
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
