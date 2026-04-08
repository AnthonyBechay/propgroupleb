import {
  Bot,
  Sparkles,
  Settings,
  MessageSquare,
  TrendingUp,
  Zap,
  Shield
} from 'lucide-react'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AISettingsPage() {
  // Layout already handles authentication

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1B3A5C] rounded-xl flex items-center justify-center shadow-md">
            <Bot className="h-6 w-6 text-white" />
          </div>
          AI Search Settings
        </h1>
        <p className="text-slate-600 mt-1">Configure and manage the AI-powered property search assistant</p>
      </div>

      {/* Overview Cards - Updated styling */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border-2 border-slate-100 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-[#1B3A5C] rounded-xl flex items-center justify-center shadow-md">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-black text-gray-900">1,234</span>
          </div>
          <h3 className="font-bold text-gray-900 mb-1">AI Searches</h3>
          <p className="text-sm text-slate-600 mb-3">Total searches this month</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">87%</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Success Rate</h3>
          <p className="text-sm text-gray-600">Queries with results</p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>+5% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">2.1s</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Avg Response Time</h3>
          <p className="text-sm text-gray-600">Query processing speed</p>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>0.3s faster</span>
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">AI Configuration</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {/* Enable/Disable AI Search */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Enable AI Search</h3>
                <p className="text-sm text-gray-600">Allow users to search properties using natural language</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Show floating AI assistant */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Floating AI Assistant</h3>
                <p className="text-sm text-gray-600">Display floating AI chat button on all pages</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Default search mode */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Default Search Mode</h3>
                <p className="text-sm text-gray-600">Set AI search as the default on homepage</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Max results */}
            <div className="pb-6 border-b border-gray-200">
              <label className="block mb-2">
                <span className="font-semibold text-gray-900">Maximum Results</span>
                <p className="text-sm text-gray-600">Limit the number of properties returned per search</p>
              </label>
              <select className="mt-2 block w-full max-w-xs px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="25">25 properties</option>
                <option value="50" selected>50 properties</option>
                <option value="100">100 properties</option>
                <option value="200">200 properties</option>
              </select>
            </div>

            {/* Response timeout */}
            <div>
              <label className="block mb-2">
                <span className="font-semibold text-gray-900">Response Timeout</span>
                <p className="text-sm text-gray-600">Maximum time to wait for AI processing (seconds)</p>
              </label>
              <select className="mt-2 block w-full max-w-xs px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="5">5 seconds</option>
                <option value="10" selected>10 seconds</option>
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Reset to Defaults
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Popular Search Queries */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Popular Search Queries</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[
              { query: "3 bedroom apartment in Cyprus under $300k", count: 156 },
              { query: "Golden Visa properties in Greece", count: 142 },
              { query: "Properties with high ROI", count: 98 },
              { query: "New build apartments in Georgia", count: 87 },
              { query: "Luxury villas between $500k and $1M", count: 76 }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <span className="text-sm text-gray-900">{item.query}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                  <span className="text-xs text-gray-500">searches</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
