'use client'

import Link from 'next/link'
import {
  Building2,
  Phone,
  Mail,
  Facebook,
  Twitter,
  Linkedin,
  Instagram
} from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Main Footer */}
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
            <p className="text-xs text-gray-400 mb-3">
              AI-powered real estate investment platform helping you make smarter property decisions.
            </p>
            <div className="flex gap-2">
              <a href="#" aria-label="Facebook" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Facebook className="w-4 h-4 text-gray-400 hover:text-white" />
              </a>
              <a href="#" aria-label="Twitter" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-blue-400 transition-colors">
                <Twitter className="w-4 h-4 text-gray-400 hover:text-white" />
              </a>
              <a href="#" aria-label="LinkedIn" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors">
                <Linkedin className="w-4 h-4 text-gray-400 hover:text-white" />
              </a>
              <a href="#" aria-label="Instagram" className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-pink-600 transition-colors">
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
            <h4 className="font-semibold text-sm mb-2">Company</h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-xs">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-xs">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/ai-search" className="text-gray-400 hover:text-white transition-colors text-xs">
                  AI Search
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
              &copy; {currentYear} PropGroup. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
