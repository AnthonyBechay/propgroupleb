'use client'

import { useMemo, type ReactNode } from 'react'

/**
 * A property description as the admin wrote it — emoji, line breaks and all —
 * laid out so it reads as nicely as it was typed.
 *
 * The team writes in a loose, elegant convention rather than markdown:
 *   🌊 Sea view from every floor          ← emoji lines: a feature list
 *   💰 PAYMENT PLAN:                       ← emoji + caps or ":" : a section heading
 *   • 30% down payment                     ← bullets (•, -, *) and numbers (1. 2))
 *   (blank line)                           ← a blank line, kept: two give twice the space
 *
 * Emoji lines used to come out as loose separate paragraphs (Georgia) or as
 * one plain block (Lebanon). Here consecutive emoji lines become an aligned
 * list — the emoji in its own column, the text lined up beside it.
 *
 * Every Enter the admin typed is kept. A first version merged any run of
 * blank lines into one gap, which undid the spacing people lay out on
 * purpose; now each blank line is one line's worth of space.
 *
 * Plain JSX, no dangerouslySetInnerHTML: nothing an admin pastes can inject
 * markup. The same file lives in both storefront repos (propgroup and
 * propgroupleb) so the two sites render a description identically.
 */

/** A line opening with an emoji: pictographs, flags (🇬🇪), keycaps (1️⃣), ⭐, ✅ … */
const EMOJI_START = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]️?⃣)/u
/** The emoji itself, with its variation selector / skin tone / ZWJ sequence. */
const EMOJI_TOKEN = /^(?:\p{Regional_Indicator}{2}|[0-9#*]️?⃣|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)\s*/u
const BULLET = /^[•▪●◦\-*–]\s+/
const NUMBERED = /^(\d{1,2})[.)]\s+/

type Block =
  | { type: 'heading'; emoji: string | null; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'emoji'; items: Array<{ emoji: string; text: string }> }
  | { type: 'gap'; lines: number }

function splitEmoji(line: string): { emoji: string; text: string } | null {
  const m = line.match(EMOJI_TOKEN)
  if (!m) return null
  return { emoji: m[0].trim(), text: line.slice(m[0].length).trim() }
}

function isHeading(line: string, text: string): boolean {
  if (line.endsWith(':')) return true
  if (text.length > 80) return false
  // Opens with a name in capitals: "🌊 PHIROSMANI RESIDENCE – Batumi's New
  // Seafront Address", "🌍 BATUMI – Georgia's Rising Hotspot".
  if (/^[A-Z][A-Z0-9'’&-]{3,}(\s|$)/.test(text)) return true
  // Or is mostly capitals: "💰 PAYMENT PLAN", "📈 ROI 10%".
  const letters = text.replace(/[^A-Za-z]/g, '')
  return letters.length >= 3 && (letters.match(/[A-Z]/g)?.length ?? 0) / letters.length > 0.6
}

export function parseDescription(description: string): Block[] {
  const blocks: Block[] = []
  const last = () => blocks[blocks.length - 1]

  for (const raw of description.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      // Each blank line is kept: one blank line, one line of space.
      const prev = last()
      if (prev?.type === 'gap') prev.lines += 1
      else if (blocks.length) blocks.push({ type: 'gap', lines: 1 })
      continue
    }
    const bullet = line.match(BULLET)
    if (bullet) {
      const text = line.slice(bullet[0].length)
      const prev = last()
      if (prev?.type === 'bullets') prev.items.push(text)
      else blocks.push({ type: 'bullets', items: [text] })
      continue
    }
    const numbered = line.match(NUMBERED)
    if (numbered) {
      const text = line.slice(numbered[0].length)
      const prev = last()
      if (prev?.type === 'numbered') prev.items.push(text)
      else blocks.push({ type: 'numbered', items: [text] })
      continue
    }
    if (EMOJI_START.test(line)) {
      const parts = splitEmoji(line)
      if (parts && parts.text) {
        if (isHeading(line, parts.text)) {
          blocks.push({ type: 'heading', emoji: parts.emoji, text: parts.text.replace(/:$/, '') })
        } else {
          const prev = last()
          if (prev?.type === 'emoji') prev.items.push(parts)
          else blocks.push({ type: 'emoji', items: [parts] })
        }
        continue
      }
    }
    // A short line ending in ":" with no emoji is a heading too ("Amenities:").
    if (line.endsWith(':') && line.length <= 60) {
      blocks.push({ type: 'heading', emoji: null, text: line.replace(/:$/, '') })
      continue
    }
    blocks.push({ type: 'paragraph', text: line })
  }
  while (last()?.type === 'gap') blocks.pop()
  return blocks
}

const URL_OR_EMAIL = /(https?:\/\/[^\s<>()[\]"]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g

/** **bold**, links and emails inside a line. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  text.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
    if (!part) return
    part.split(URL_OR_EMAIL).forEach((tok, j) => {
      if (!tok) return
      const k = `${key}-${i}-${j}`
      if (/^https?:\/\//.test(tok)) {
        out.push(<a key={k} href={tok} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">{tok}</a>)
      } else if (/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(tok)) {
        out.push(<a key={k} href={`mailto:${tok}`} className="underline underline-offset-2">{tok}</a>)
      } else if (i % 2 === 1) {
        out.push(<strong key={k} className="font-semibold text-slate-900">{tok}</strong>)
      } else {
        out.push(<span key={k}>{tok}</span>)
      }
    })
  })
  return out
}

export function PropertyDescription({ description, className = '' }: { description: string; className?: string }) {
  const blocks = useMemo(() => parseDescription(description || ''), [description])
  if (blocks.length === 0) return null

  return (
    <div className={`text-[15px] leading-relaxed text-slate-700 max-w-3xl ${className}`}>
      {blocks.map((b, i) => {
        const key = `d-${i}`
        // Spacing between blocks lives here. After blank lines: one line-height
        // per blank line, as typed. Otherwise lines sit as close as a line
        // break — a heading gets a little air.
        const before = i > 0 ? blocks[i - 1] : null
        const space = !before ? '' : before.type === 'gap' ? '' : b.type === 'heading' ? 'mt-3' : 'mt-1'
        const style = before?.type === 'gap' ? { marginTop: `${Math.min(before.lines, 6) * 1.65}em` } : undefined
        switch (b.type) {
          case 'gap':
            return null
          case 'heading':
            return (
              <h3 key={key} style={style} className={`${space} flex items-baseline gap-2 text-base font-semibold text-slate-900 sm:text-[17px]`}>
                {b.emoji && <span aria-hidden className="text-lg leading-none">{b.emoji}</span>}
                <span>{inline(b.text, key)}</span>
              </h3>
            )
          case 'emoji':
            return (
              <ul key={key} style={style} className={`${space} space-y-1.5`}>
                {b.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span aria-hidden className="w-6 shrink-0 text-center text-[17px] leading-relaxed">{it.emoji}</span>
                    <span className="flex-1">{inline(it.text, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'bullets':
            return (
              <ul key={key} style={style} className={`${space} space-y-1.5`}>
                {b.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span aria-hidden className="w-6 shrink-0 text-center leading-relaxed text-slate-400">•</span>
                    <span className="flex-1">{inline(it, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'numbered':
            return (
              <ol key={key} style={style} className={`${space} space-y-1.5`}>
                {b.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span aria-hidden className="w-6 shrink-0 text-center font-medium tabular-nums text-slate-500">{j + 1}.</span>
                    <span className="flex-1">{inline(it, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ol>
            )
          default:
            return <p key={key} style={style} className={space}>{inline(b.text, key)}</p>
        }
      })}
    </div>
  )
}

/**
 * The description cut for a PDF or a preview without breaking a line or a
 * word: whole lines up to `max` characters, then "…".
 */
export function trimDescription(description: string, max: number): string {
  const text = description.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (text.length <= max) return text
  let out = ''
  for (const line of text.split('\n')) {
    if ((out + '\n' + line).length > max) break
    out = out ? `${out}\n${line}` : line
  }
  if (!out) out = text.slice(0, max).replace(/\s+\S*$/, '')
  return `${out.trimEnd()} …`
}
