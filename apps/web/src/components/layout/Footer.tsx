'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
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
    <footer className="relative bg-zinc-900 text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          {/* Company Info */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Image
                src="/logo.png"
                alt="PropGroup"
                width={36}
                height={36}
                className="brightness-0 invert"
              />
              <div>
                <h3 className="font-bold text-base">PropGroup</h3>
                <p className="text-xs text-zinc-300">Lebanon Real Estate</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 mb-3">
              Lebanon's trusted brokerage for buying, renting, selling, and managing real estate.
            </p>
            {/* Social icons rendered as disabled placeholders until real
                URLs are wired. href="#" alone would jump the page to top
                on click — preventDefault keeps the layout stable. */}
            <div className="flex gap-2">
              <a
                href="#"
                aria-label="Facebook (coming soon)"
                aria-disabled="true"
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center cursor-default opacity-60"
              >
                <Facebook className="w-4 h-4 text-zinc-300" />
              </a>
              <a
                href="#"
                aria-label="Twitter (coming soon)"
                aria-disabled="true"
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center cursor-default opacity-60"
              >
                <Twitter className="w-4 h-4 text-zinc-300" />
              </a>
              <a
                href="#"
                aria-label="LinkedIn (coming soon)"
                aria-disabled="true"
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center cursor-default opacity-60"
              >
                <Linkedin className="w-4 h-4 text-zinc-300" />
              </a>
              <a
                href="#"
                aria-label="Instagram (coming soon)"
                aria-disabled="true"
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center cursor-default opacity-60"
              >
                <Instagram className="w-4 h-4 text-zinc-300" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Explore</h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/properties" className="text-zinc-300 hover:text-white transition-colors text-xs">
                  Properties
                </Link>
              </li>
              <li>
                <Link href="/listings" className="text-zinc-300 hover:text-white transition-colors text-xs">
                  Listings
                </Link>
              </li>
              <li>
                <Link href="/portal/calculator" className="text-zinc-300 hover:text-white transition-colors text-xs">
                  Calculator
                </Link>
              </li>
              <li>
                <Link href="/portal/portfolio" className="text-zinc-300 hover:text-white transition-colors text-xs">
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
                <Link href="/about" className="text-zinc-300 hover:text-white transition-colors text-xs">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-zinc-300 hover:text-white transition-colors text-xs">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/ai-search" className="text-zinc-300 hover:text-white transition-colors text-xs">
                  AI Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Contact</h4>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-zinc-300 text-xs">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <a href="mailto:info@propgroup.com" className="hover:text-white transition-colors">
                  info@propgroup.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-zinc-300 text-xs">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <a href="tel:+96171934001" className="hover:text-white transition-colors">
                  +961 71 934 001
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-zinc-300 text-xs text-center sm:text-left">
              &copy; {currentYear} PropGroup. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs">
              <Link href="/privacy" className="text-zinc-300 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-zinc-300 hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
