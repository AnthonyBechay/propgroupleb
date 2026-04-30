'use client'

import { useMemo, type ReactNode } from 'react'

interface PropertyDescriptionProps {
  description: string
}

/**
 * Lightweight rich-text renderer for admin-authored property descriptions.
 *
 * The admin team pastes content from external docs that uses a loose
 * convention rather than strict markdown: bullet lines with `•`, section
 * headers prefixed with emoji (💰, 🏢, ✨, 🌍, 📈, 💼, 📍, 📞), money
 * tables, and inline links/emails. The previous parser only handled
 * `- ` bullets and `**bold**`, so the same paste rendered as a wall of
 * text. This version classifies each line and renders proper JSX —
 * safer than dangerouslySetInnerHTML (no XSS surface) and gives better
 * typographic hierarchy.
 *
 * Recognised patterns (line-level, in order):
 *   • / - / *           → bullet list item (groups consecutive into <ul>)
 *   leading emoji + ":" or short uppercase phrase → section header
 *   blank line          → paragraph break
 *   anything else       → paragraph
 *
 * Inline patterns (within a line):
 *   **text**            → bold
 *   http(s)://…         → external link (opens in new tab)
 *   email@example.com   → mailto link
 *
 * If you need true rich text in the future (tables, images, code),
 * graduate to a real markdown lib (`marked` + DOMPurify, or `react-markdown`).
 * Until then this covers what admins actually type.
 */

// Unicode emoji range — broad on purpose. Matches the leading-emoji
// patterns admins use for section headers without having to enumerate.
const EMOJI_PREFIX_RE = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}✨\u{1F000}-\u{1F02F}]/u

const BULLET_RE = /^\s*[•\*\-]\s+/

// URL + email patterns for inline auto-linking.
// URL is greedy on purpose — admins paste full URLs, terminator is whitespace
// or specific punctuation followed by space/end.
const URL_RE = /(https?:\/\/[^\s<>()\[\]"]+)/g
const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g

/**
 * Render a single line's inline formatting (bold, URLs, emails).
 * Returns an array of React nodes; we walk the string left-to-right and
 * convert recognised tokens into elements.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on bold markers first to preserve them around link/email scans.
  // `**foo**` → ['', 'foo', ''] with even indices being plain, odd being bold.
  const boldParts = text.split(/\*\*(.+?)\*\*/g)
  const out: ReactNode[] = []

  boldParts.forEach((part, idx) => {
    const isBold = idx % 2 === 1
    if (!part) return

    // Within each part, scan for URLs and emails. Use a single combined
    // regex so order is preserved.
    const tokens = part.split(/(https?:\/\/[^\s<>()\[\]"]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)
    tokens.forEach((tok, tIdx) => {
      if (!tok) return
      const k = `${keyPrefix}-${idx}-${tIdx}`
      if (URL_RE.test(tok)) {
        // Reset lastIndex because the global regex .test mutates it
        URL_RE.lastIndex = 0
        out.push(
          <a
            key={k}
            href={tok}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1B3A5C] underline underline-offset-2 hover:text-[#24507D]"
          >
            {tok}
          </a>,
        )
      } else if (EMAIL_RE.test(tok)) {
        EMAIL_RE.lastIndex = 0
        out.push(
          <a
            key={k}
            href={`mailto:${tok}`}
            className="text-[#1B3A5C] underline underline-offset-2 hover:text-[#24507D]"
          >
            {tok}
          </a>,
        )
      } else if (isBold) {
        out.push(
          <strong key={k} className="font-semibold text-slate-800">
            {tok}
          </strong>,
        )
      } else {
        out.push(<span key={k}>{tok}</span>)
      }
    })
  })

  return out
}

type Block =
  | { type: 'header'; text: string; key: string }
  | { type: 'paragraph'; text: string; key: string }
  | { type: 'bullets'; items: string[]; key: string }
  | { type: 'spacer'; key: string }

/**
 * Classify lines into block-level structures, grouping consecutive
 * bullets into a single list block.
 */
function parseBlocks(description: string): Block[] {
  const lines = description.split('\n')
  const blocks: Block[] = []
  let bulletBuffer: string[] = []
  let key = 0
  const k = () => `b-${key++}`

  const flushBullets = () => {
    if (bulletBuffer.length) {
      blocks.push({ type: 'bullets', items: bulletBuffer, key: k() })
      bulletBuffer = []
    }
  }

  for (const raw of lines) {
    const line = raw.trim()

    if (!line) {
      flushBullets()
      blocks.push({ type: 'spacer', key: k() })
      continue
    }

    const bulletMatch = line.match(BULLET_RE)
    if (bulletMatch) {
      bulletBuffer.push(line.slice(bulletMatch[0].length))
      continue
    }

    flushBullets()

    // Section header heuristic: emoji-prefixed AND (ends with ":" OR is
    // short-and-mostly-uppercase). Catches "💰 UNIT PRICING:" and
    // "🌍 BATUMI – Georgia's Rising Investment Hotspot".
    const startsWithEmoji = EMOJI_PREFIX_RE.test(line)
    const endsWithColon = line.endsWith(':')
    const isShort = line.length <= 80
    const upperRatio = (line.match(/[A-Z]/g)?.length ?? 0) / line.length
    const looksLikeHeader =
      startsWithEmoji && (endsWithColon || (isShort && upperRatio > 0.15))

    if (looksLikeHeader) {
      blocks.push({ type: 'header', text: line, key: k() })
    } else {
      blocks.push({ type: 'paragraph', text: line, key: k() })
    }
  }

  flushBullets()
  // Trim leading/trailing spacers — they're noise.
  while (blocks[0]?.type === 'spacer') blocks.shift()
  while (blocks[blocks.length - 1]?.type === 'spacer') blocks.pop()

  return blocks
}

export function PropertyDescription({ description }: PropertyDescriptionProps) {
  const blocks = useMemo(() => parseBlocks(description || ''), [description])

  if (blocks.length === 0) return null

  return (
    <div className="text-base sm:text-[15px] text-slate-700 leading-relaxed max-w-3xl space-y-3">
      {blocks.map((block) => {
        switch (block.type) {
          case 'header':
            return (
              <h3
                key={block.key}
                className="font-bold text-slate-900 text-base sm:text-lg pt-3 first:pt-0"
              >
                {renderInline(block.text, block.key)}
              </h3>
            )
          case 'bullets':
            return (
              <ul key={block.key} className="space-y-1.5 pl-1">
                {block.items.map((item, i) => (
                  <li
                    key={`${block.key}-i-${i}`}
                    className="flex gap-2.5 items-start"
                  >
                    <span className="text-[#C49A2E] mt-[0.4em] shrink-0 leading-none">
                      •
                    </span>
                    <span className="flex-1">
                      {renderInline(item, `${block.key}-i-${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          case 'spacer':
            // Tailwind `space-y-3` on the parent already gives gap; an empty
            // line in source means a paragraph-level pause, render a slightly
            // larger gap.
            return <div key={block.key} className="h-2" aria-hidden />
          case 'paragraph':
          default:
            return (
              <p key={block.key} className="leading-relaxed">
                {renderInline(block.text, block.key)}
              </p>
            )
        }
      })}
    </div>
  )
}
