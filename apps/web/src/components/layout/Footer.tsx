'use client'

import Link from 'next/link'
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram,
  ArrowRight,
  Globe,
  Shield,
  Award,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { toast } from '@/components/ui/use-toast'

export function Footer() {
  const [email, setEmail] = useState('')
  const [isSubscribing, setIsSubscribing] = useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubscribing(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    toast({
      title: "Successfully subscribed!",
      description: "You'll receive our latest investment opportunities and market insights.",
    })
    
    setEmail('')
    setIsSubscribing(false)
  }

  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Compact Newsletter Section */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-bold mb-1">Stay Ahead of the Market</h3>
                <p className="text-gray-300 text-sm">
                  Get exclusive opportunities and insights.
                </p>
              </div>
              <form onSubmit={handleSubscribe} className="flex gap-2 w-full sm:w-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 sm:w-64 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20 h-10"
                />
                <Button
                  type="submit"
                  disabled={isSubscribing}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-10 px-4"
                >
                  {isSubscribing ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          {/* Company Info */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base">PropGroup</h3>
                <p className="text-xs text-gray-400">Smart Investments</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href="#" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Facebook className="w-4 h-4 text-gray-400 hover:text-white" />
              </a>
              <a href="#" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-blue-400 transition-colors">
                <Twitter className="w-4 h-4 text-gray-400 hover:text-white" />
              </a>
              <a href="#" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors">
                <Linkedin className="w-4 h-4 text-gray-400 hover:text-white" />
              </a>
              <a href="#" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-pink-600 transition-colors">
                <Instagram className="w-4 h-4 text-gray-400 hover:text-white" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Invest</h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/properties" className="text-gray-400 hover:text-white transition-colors text-xs">
                  Properties
                </Link>
              </li>
              <li>
                <Link href="/portal/calculator" className="text-gray-400 hover:text-white transition-colors text-xs">
                  Calculator
                </Link>
              </li>
              <li>
                <Link href="/portal/portfolio" className="text-gray-400 hover:text-white transition-colors text-xs">
                  Portfolio
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Resources</h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-xs">
                  About
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-400 hover:text-white transition-colors text-xs">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-white transition-colors text-xs">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Contact</h4>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-gray-400 text-xs">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <a href="mailto:invest@propgroup.com" className="hover:text-white transition-colors">
                  invest@propgroup.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-xs">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <a href="tel:+97142345678" className="hover:text-white transition-colors">
                  +971 4 234 5678
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-gray-400 text-xs text-center sm:text-left">
              © {currentYear} PropGroup. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/cookies" className="text-gray-400 hover:text-white transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
