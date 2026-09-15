/**
 * Pull a property's numbers out of a block of prose.
 *
 * Stock does not arrive as a form. It arrives as a WhatsApp message from an
 * owner or a developer — "Apartment in Achrafieh, S+2, 145m2, 4th floor,
 * 285,000$ negotiable" — and somebody then retypes six numbers into six boxes.
 * Pasting the message and correcting what it got wrong is faster than typing
 * it out, and a great deal faster on a phone.
 *
 * This is deliberately conservative: it only reports a field when the text is
 * unambiguous about it, because a wrong number silently filled in is worse than
 * an empty one. Everything it finds is shown for confirmation before it is
 * applied — nothing is written behind the user's back.
 */

export interface ParsedProperty {
  price?: number
  currency?: 'USD' | 'LBP'
  areaSqm?: number
  bedrooms?: number
  bathrooms?: number
  floor?: number
  locationUrl?: string
  negotiable?: boolean
}

/** "285,000" / "285.000" / "285k" / "1.2m" → a number. */
function parseAmount(raw: string): number | undefined {
  const cleaned = raw.trim().toLowerCase().replace(/\s/g, '')
  const suffix = /([km])$/.exec(cleaned)?.[1]
  // Thousands separators are written both ways in the region; either way the
  // groups are three digits, which is what tells them apart from a decimal.
  const digits = cleaned
    .replace(/[km]$/, '')
    .replace(/[,.](?=\d{3}\b)/g, '')
    .replace(',', '.')
  const n = Number(digits)
  if (!Number.isFinite(n) || n <= 0) return undefined
  if (suffix === 'k') return n * 1_000
  if (suffix === 'm') return n * 1_000_000
  return n
}

export function parsePropertyText(text: string): ParsedProperty {
  const out: ParsedProperty = {}
  if (!text?.trim()) return out
  const t = text.replace(/ /g, ' ')
  const lower = t.toLowerCase()

  // ── Area ──────────────────────────────────────────────────────────────────
  // Read before price: "145m2" and "285,000$" both contain a bare number, and
  // taking the area out first stops it being mistaken for money.
  const area = /(\d[\d.,]*)\s*(?:m²|m2|sqm|sq\.?\s?m|متر)/i.exec(t)
  if (area) {
    const n = parseAmount(area[1])
    // A plausible floor area. Anything outside this is a typo or a plot in
    // dunums, and guessing would be worse than leaving it blank.
    if (n && n >= 5 && n <= 100_000) out.areaSqm = n
  }

  // ── Price ─────────────────────────────────────────────────────────────────
  const priceMatch =
    /(?:\$|usd)\s*(\d[\d.,]*\s*[km]?)/i.exec(t)
    ?? /(\d[\d.,]*\s*[km]?)\s*(?:\$|usd\b)/i.exec(t)
    ?? /(?:price|سعر|prix)\s*[:\-]?\s*(\d[\d.,]*\s*[km]?)/i.exec(t)
  if (priceMatch) {
    const n = parseAmount(priceMatch[1])
    if (n && n >= 1_000) {
      out.price = n
      out.currency = 'USD'
    }
  } else {
    const lbp = /(\d[\d.,]*\s*[km]?)\s*(?:lbp|l\.?l\.?|ل\.ل)/i.exec(t)
    if (lbp) {
      const n = parseAmount(lbp[1])
      if (n) { out.price = n; out.currency = 'LBP' }
    }
  }

  // ── Bedrooms ──────────────────────────────────────────────────────────────
  // `S+2` is the Lebanese shorthand — salon plus two bedrooms — and it is how
  // most of this stock is actually described.
  const salon = /\bs\s*\+\s*(\d)\b/i.exec(t)
  if (salon) {
    out.bedrooms = Number(salon[1])
  } else {
    const beds = /(\d+)\s*(?:bed\s?rooms?|bedrooms?|\bbr\b|\bbeds?\b|chambres?|غرف)/i.exec(t)
    if (beds) {
      const n = Number(beds[1])
      if (n >= 0 && n <= 30) out.bedrooms = n
    }
  }

  // ── Bathrooms ─────────────────────────────────────────────────────────────
  const baths = /(\d+)\s*(?:bath\s?rooms?|bathrooms?|\bbaths?\b|\bwc\b|toilets?|حمام)/i.exec(t)
  if (baths) {
    const n = Number(baths[1])
    if (n >= 0 && n <= 30) out.bathrooms = n
  }

  // ── Floor ─────────────────────────────────────────────────────────────────
  const floorOrdinal = /(\d+)\s*(?:st|nd|rd|th)?\s*floor/i.exec(t)
    ?? /floor\s*[:\-]?\s*(\d+)/i.exec(t)
    ?? /(?:étage|etage|طابق)\s*[:\-]?\s*(\d+)/i.exec(t)
  if (floorOrdinal) {
    const n = Number(floorOrdinal[1])
    if (n >= 0 && n <= 200) out.floor = n
  } else if (/\bground\s*floor\b|\brez[-\s]?de[-\s]?chauss/i.test(lower)) {
    out.floor = 0
  }

  // ── Extras ────────────────────────────────────────────────────────────────
  const maps = /(https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)\S*)/i.exec(t)
  if (maps) out.locationUrl = maps[1]

  if (/\bnegotiable\b|\bneg\.?\b|قابل للتفاوض/i.test(lower)) out.negotiable = true

  return out
}

/** Human labels for what was found, for the confirmation step. */
export function describeParsed(p: ParsedProperty): Array<{ key: keyof ParsedProperty; label: string; value: string }> {
  const rows: Array<{ key: keyof ParsedProperty; label: string; value: string }> = []
  if (p.price !== undefined) {
    rows.push({
      key: 'price',
      label: 'Price',
      value: p.currency === 'LBP' ? `${p.price.toLocaleString()} LBP` : `$${p.price.toLocaleString()}`,
    })
  }
  if (p.areaSqm !== undefined) rows.push({ key: 'areaSqm', label: 'Area', value: `${p.areaSqm} m²` })
  if (p.bedrooms !== undefined) rows.push({ key: 'bedrooms', label: 'Bedrooms', value: String(p.bedrooms) })
  if (p.bathrooms !== undefined) rows.push({ key: 'bathrooms', label: 'Bathrooms', value: String(p.bathrooms) })
  if (p.floor !== undefined) {
    rows.push({ key: 'floor', label: 'Floor', value: p.floor === 0 ? 'Ground' : String(p.floor) })
  }
  if (p.negotiable) rows.push({ key: 'negotiable', label: 'Price', value: 'Negotiable' })
  if (p.locationUrl) rows.push({ key: 'locationUrl', label: 'Map link', value: 'Found' })
  return rows
}
