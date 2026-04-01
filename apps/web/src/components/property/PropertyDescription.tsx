'use client'

import { useMemo } from 'react'

interface PropertyDescriptionProps {
  description: string
}

function parseMarkdown(text: string): string {
  if (!text) return ''

  let html = text

  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Convert lines starting with "- " into list items
  // Split by newline, group consecutive list items into <ul>
  const lines = html.split('\n')
  const result: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        result.push('<ul class="list-disc pl-5 my-2 space-y-1">')
        inList = true
      }
      result.push(`<li>${trimmed.slice(2)}</li>`)
    } else {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      if (trimmed === '') {
        result.push('<br/>')
      } else {
        result.push(trimmed)
      }
    }
  }

  if (inList) {
    result.push('</ul>')
  }

  // Join non-list, non-break lines with <br/>
  let finalHtml = ''
  for (let i = 0; i < result.length; i++) {
    const item = result[i]
    if (
      item.startsWith('<ul') ||
      item.startsWith('</ul') ||
      item.startsWith('<li') ||
      item === '<br/>'
    ) {
      finalHtml += item
    } else {
      // Regular text line: add <br/> between consecutive text lines
      if (finalHtml.length > 0 && !finalHtml.endsWith('<br/>') && !finalHtml.endsWith('</ul>')) {
        finalHtml += '<br/>'
      }
      finalHtml += item
    }
  }

  return finalHtml
}

export function PropertyDescription({ description }: PropertyDescriptionProps) {
  const html = useMemo(() => parseMarkdown(description), [description])

  return (
    <div
      className="text-lg text-stone-600 max-w-3xl leading-relaxed prose-strong:text-stone-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
