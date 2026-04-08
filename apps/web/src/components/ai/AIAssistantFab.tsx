'use client'

import { useState } from 'react'
import { Bot, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIPropertySearch } from './AIPropertySearch'

export function AIAssistantFab() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl bg-[#1B3A5C] hover:bg-[#24507D] z-50 group"
          size="lg"
        >
          <div className="relative">
            <Bot className="w-7 h-7 text-white" />
            <Sparkles className="w-3 h-3 text-[#C49A2E] absolute -top-1 -right-1 animate-pulse" />
          </div>
          <span className="sr-only">Open AI Assistant</span>
        </Button>
      )}

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-full max-w-lg z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="relative">
            <Button
              onClick={() => setIsOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 shadow-lg z-10 p-0"
              size="sm"
            >
              <X className="w-4 h-4 text-white" />
            </Button>
            <AIPropertySearch variant="modal" />
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
