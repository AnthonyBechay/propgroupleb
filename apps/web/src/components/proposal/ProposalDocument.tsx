/**
 * The document a client receives — on screen and on paper, from one renderer.
 *
 * Deliberately not built with the admin's Tailwind vocabulary. Print is a
 * different medium: `print-color-adjust` is a suggestion browsers may ignore,
 * so nothing may depend on a background colour surviving; the page is 210mm
 * wide whatever the screen is; and a section that splits across a page boundary
 * mid-table is the one failure that makes a PDF look amateur. Inline styles
 * with explicit `breakInside: avoid` are the reliable way to get all three, and
 * are what the existing `ProposalExport` already proved works in this codebase.
 *
 * Structure follows `profile`, because the two buyers ask different questions
 * first — see `lib/proposal.ts`.
 */

import { normalizeFileUrl } from '@/lib/utils/api-url'
import {
  formatMoney, formatProposalDate, instalmentSchedule,
  type Proposal, type ProposalUnit,
} from '@/lib/proposal'

// Print-safe palette. Everything readable in greyscale — a lot of these get
// printed on an office laser printer, not saved as a PDF.
const INK = '#0f172a'
const BODY = '#334155'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const ACCENT = '#0f172a'

export interface ProposalBranding {
  logoUrl: string
  companyName: string
  phone: string
  email: string
  website: string
}

export const DEFAULT_BRANDING: ProposalBranding = {
  logoUrl: '/logo.png',
  companyName: 'PropGroup',
  phone: '+961 71 934 001',
  email: 'info@propgroup.com',
  website: 'propgroup.com',
}

const noBreak: React.CSSProperties = { breakInside: 'avoid', pageBreakInside: 'avoid' }

export function ProposalDocument({
  proposal, branding = DEFAULT_BRANDING, generatedAt,
}: {
  proposal: Proposal
  branding?: ProposalBranding
  /** Passed in rather than read from the clock, so server and client agree. */
  generatedAt: string
}) {
  const p = proposal
  const investmentFirst = p.profile === 'investment'

  // The blocks, assembled in the order this document's reader needs them.
  const theProperty = (
    <>
      <Description p={p} />
      <FactsAndAmenities p={p} />
      <Units p={p} />
    </>
  )
  const theInvestment = (
    <>
      <InvestmentCase p={p} />
      <TheNumbers p={p} />
      <Delivery p={p} />
    </>
  )

  return (
    <article
      id="pg-proposal"
      style={{
        width: '210mm',
        maxWidth: '100%',
        margin: '0 auto',
        background: '#fff',
        color: BODY,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: 11,
        lineHeight: 1.55,
      }}
    >
      <Cover p={p} branding={branding} />

      <div style={{ padding: '0 16mm 16mm' }}>
        {investmentFirst ? <>{theInvestment}{theProperty}</> : <>{theProperty}{theInvestment}</>}

        <PaymentPlans p={p} />
        <Gallery p={p} />
        <Location p={p} />
        <Documents p={p} />
        <Contact branding={branding} generatedAt={generatedAt} p={p} />
      </div>
    </article>
  )
}

// ── Cover ─────────────────────────────────────────────────────────────────────

function Cover({ p, branding }: { p: Proposal; branding: ProposalBranding }) {
  return (
    <header style={{ ...noBreak, padding: '14mm 16mm 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.logoUrl} alt={branding.companyName} style={{ height: 34, width: 'auto' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, letterSpacing: 0.2 }}>
              {branding.companyName}
            </div>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {p.documentTitle}
            </div>
          </div>
        </div>
        {p.reference && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>Reference</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: 'ui-monospace, monospace' }}>
              {p.reference}
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 2, background: ACCENT, margin: '10px 0 14px' }} />

      <h1 style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 700, color: INK, margin: 0 }}>{p.title}</h1>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{p.location}</div>
      {p.subtitle && (
        <p style={{ fontSize: 11.5, color: BODY, margin: '8px 0 0', maxWidth: '150mm' }}>{p.subtitle}</p>
      )}

      {p.coverImage && (
        <div style={{ ...noBreak, marginTop: 12, borderRadius: 6, overflow: 'hidden', border: `1px solid ${LINE}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizeFileUrl(p.coverImage)}
            alt=""
            style={{ display: 'block', width: '100%', height: '78mm', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* The price and the facts that qualify it, together, above the fold. */}
      <div
        style={{
          ...noBreak,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 12,
          paddingBottom: 12,
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        <div>
          {p.price ? (
            <>
              {p.price.prefix && (
                <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {p.price.prefix}
                </div>
              )}
              <div style={{ fontSize: 26, fontWeight: 700, color: INK, lineHeight: 1.1 }}>
                {p.price.formatted}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>Price on application</div>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', maxWidth: '110mm', justifyContent: 'flex-end' }}>
          {p.facts.slice(0, 6).map((f) => (
            <div key={f.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase' }}>{f.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}

// ── Section furniture ─────────────────────────────────────────────────────────

function Section({
  title, subtitle, children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ ...noBreak, marginBottom: 9 }}>
        <h2
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: INK,
            margin: 0,
            paddingBottom: 5,
            borderBottom: `1.5px solid ${INK}`,
          }}
        >
          {title}
        </h2>
        {subtitle && <div style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>{subtitle}</div>}
      </div>
      {children}
    </section>
  )
}

/** A figure with its name. The building block of the investment pages. */
function Metric({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div
      style={{
        ...noBreak,
        flex: '1 1 0',
        minWidth: '38mm',
        border: `1px solid ${LINE}`,
        borderRadius: 5,
        padding: '9px 11px',
      }}
    >
      <div style={{ fontSize: 8, color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.25, marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{note}</div>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '5px 0',
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color: INK, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ── The investment case ───────────────────────────────────────────────────────

function InvestmentCase({ p }: { p: Proposal }) {
  const i = p.investment
  const metrics = [
    i.expectedROI != null && { label: 'Expected ROI', value: `${i.expectedROI}%`, note: 'Projected return' },
    i.rentalYield != null && { label: 'Rental yield', value: `${i.rentalYield}%`, note: 'Gross, per year' },
    i.capitalGrowth != null && { label: 'Capital growth', value: `${i.capitalGrowth}%`, note: 'Projected' },
    i.annualAppreciation != null && { label: 'Appreciation', value: `${i.annualAppreciation}%`, note: 'Per year' },
  ].filter(Boolean) as Array<{ label: string; value: string; note: string }>

  if (metrics.length === 0) return null

  return (
    <Section
      title="The investment case"
      subtitle={`Projected figures for ${p.countryLabel}. Not a guarantee of future performance.`}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {metrics.map((m) => <Metric key={m.label} {...m} />)}
      </div>
      {i.averageRentPerMonth != null && (
        <div style={{ ...noBreak, fontSize: 10.5, color: BODY, marginTop: 9 }}>
          Comparable units in this area let for around{' '}
          <strong style={{ color: INK }}>{formatMoney(i.averageRentPerMonth, 'USD')} per month</strong>.
        </div>
      )}
    </Section>
  )
}

// ── The numbers ───────────────────────────────────────────────────────────────

function TheNumbers({ p }: { p: Proposal }) {
  const i = p.investment
  const entry = i.minInvestment ?? p.price?.amount ?? null
  const schedule = entry != null
    ? instalmentSchedule(entry, i.downPaymentPercentage, i.installmentYears)
    : null

  const rows: Array<{ label: string; value: string }> = []
  if (entry != null) rows.push({ label: 'Entry price', value: formatMoney(entry, p.price?.currency ?? 'USD') })
  if (schedule) {
    rows.push({ label: `Down payment (${schedule.downPct}%)`, value: formatMoney(schedule.down, p.price?.currency ?? 'USD') })
    rows.push({ label: 'Balance', value: formatMoney(schedule.balance, p.price?.currency ?? 'USD') })
    if (schedule.months > 0) {
      rows.push({ label: `Instalments (${schedule.months} months)`, value: `${formatMoney(schedule.monthly, p.price?.currency ?? 'USD')} / month` })
    }
  }
  if (i.serviceFee != null) rows.push({ label: 'Service fee', value: `${formatMoney(i.serviceFee, 'USD')} / year` })
  if (i.propertyTax != null) rows.push({ label: 'Property tax', value: `${formatMoney(i.propertyTax, 'USD')} / year` })
  if (i.mortgageAvailable) rows.push({ label: 'Mortgage', value: 'Available in this market' })

  const residency = i.isGoldenVisaEligible

  if (rows.length === 0 && !residency) return null

  return (
    <Section title="What it costs" subtitle={schedule?.months ? 'Payment schedule based on the plan below.' : undefined}>
      {rows.length > 0 && (
        <div style={{ ...noBreak, fontSize: 11 }}>
          {rows.map((r) => <Row key={r.label} {...r} />)}
        </div>
      )}
      {residency && (
        <div
          style={{
            ...noBreak,
            marginTop: 10,
            border: `1.5px solid ${INK}`,
            borderRadius: 5,
            padding: '9px 11px',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: INK, letterSpacing: 0.4 }}>
            Eligible for residency by investment
          </div>
          <div style={{ fontSize: 10, color: BODY, marginTop: 2 }}>
            {i.goldenVisaMinAmount != null
              ? `Purchases from ${formatMoney(i.goldenVisaMinAmount, 'USD')} qualify for a residency permit in ${p.countryLabel}.`
              : `This property qualifies towards a residency permit in ${p.countryLabel}.`}{' '}
            Terms are set by the authorities and can change — we will confirm the current rules before you commit.
          </div>
        </div>
      )}
    </Section>
  )
}

// ── Delivery ──────────────────────────────────────────────────────────────────

function Delivery({ p }: { p: Proposal }) {
  const i = p.investment
  const completion = formatProposalDate(i.completionDate)
  const handover = formatProposalDate(i.handoverDate)
  if (!completion && !handover && !p.buildStatus) return null

  return (
    <Section title="Delivery">
      <div style={{ ...noBreak, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {p.buildStatus && <Metric label="Stage" value={p.buildStatus} />}
        {completion && <Metric label="Completion" value={completion} note="Building finished" />}
        {handover && <Metric label="Handover" value={handover} note="Keys to the buyer" />}
      </div>
    </Section>
  )
}

// ── The property ──────────────────────────────────────────────────────────────

function Description({ p }: { p: Proposal }) {
  if (!p.description && p.highlights.length === 0) return null
  return (
    <Section title={p.profile === 'investment' ? 'The property' : 'About'}>
      {p.description && (
        <p style={{ fontSize: 11, color: BODY, margin: 0, whiteSpace: 'pre-line' }}>{p.description}</p>
      )}
      {p.highlights.length > 0 && (
        <ul
          style={{
            ...noBreak,
            listStyle: 'none',
            padding: 0,
            margin: p.description ? '10px 0 0' : 0,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3px 16px',
          }}
        >
          {p.highlights.map((h) => (
            <li key={h} style={{ fontSize: 10.5, color: BODY, paddingLeft: 12, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: INK, fontWeight: 700 }}>·</span>
              {h}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function FactsAndAmenities({ p }: { p: Proposal }) {
  if (p.facts.length === 0 && p.amenities.length === 0) return null
  return (
    <Section title="Specification">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {p.facts.length > 0 && (
          <div style={{ ...noBreak, flex: '1 1 70mm', minWidth: '60mm', fontSize: 10.5 }}>
            {p.facts.map((f) => <Row key={f.label} label={f.label} value={f.value} />)}
          </div>
        )}
        {p.amenities.length > 0 && (
          <div style={{ ...noBreak, flex: '1 1 70mm', minWidth: '60mm' }}>
            <div style={{ fontSize: 8, color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>
              Building amenities
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
              {p.amenities.map((a) => (
                <li key={a} style={{ fontSize: 10.5, color: BODY, paddingLeft: 12, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: INK, fontWeight: 700 }}>·</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Units ─────────────────────────────────────────────────────────────────────

function Units({ p }: { p: Proposal }) {
  // A single unit is already described on the cover and in the specification —
  // repeating it as a one-row table is noise.
  if (p.units.length <= 1 && p.units[0]?.options.length === 0) return null

  const anyOptions = p.units.some((u) => u.options.length > 0)

  return (
    <Section
      title={p.units.length > 1 ? 'Units & prices' : 'Finish options'}
      subtitle={anyOptions ? 'Each finish is priced per m², so the total follows the size of the unit.' : undefined}
    >
      {p.units.length > 1 && (
        <table style={{ ...noBreak, width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${INK}` }}>
              <Th align="left">Unit</Th>
              <Th align="left">Type</Th>
              <Th align="right">Beds</Th>
              <Th align="right">Area</Th>
              <Th align="right">Floor</Th>
              <Th align="right">Price</Th>
            </tr>
          </thead>
          <tbody>
            {p.units.map((u) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                <Td>
                  <span style={{ color: INK, fontWeight: 600 }}>{u.label}</span>
                  {u.ref && (
                    <span style={{ color: MUTED, fontFamily: 'ui-monospace, monospace', fontSize: 9, marginLeft: 5 }}>
                      {u.ref}
                    </span>
                  )}
                </Td>
                <Td>{u.kindLabel}</Td>
                <Td align="right">{u.bedrooms ?? '—'}</Td>
                <Td align="right">{u.areaSqm != null ? `${u.areaSqm} m²` : '—'}</Td>
                <Td align="right">{u.floor != null ? (u.floor === 0 ? 'G' : u.floor) : '—'}</Td>
                <Td align="right">
                  {u.price
                    ? <span style={{ color: INK, fontWeight: 600 }}>{formatMoney(u.price.amount, u.price.currency)}</span>
                    : <span style={{ color: MUTED }}>On application</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {p.units.filter((u) => u.options.length > 0).map((u) => (
        <UnitOptions key={u.id} unit={u} showLabel={p.units.length > 1} />
      ))}
    </Section>
  )
}

function UnitOptions({ unit, showLabel }: { unit: ProposalUnit; showLabel: boolean }) {
  return (
    <div style={{ ...noBreak, marginTop: 12 }}>
      {showLabel && (
        <div style={{ fontSize: 9, color: MUTED, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
          {unit.label}
          {unit.areaSqm != null && ` · ${unit.areaSqm} m²`}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${INK}` }}>
            <Th align="left">Finish</Th>
            <Th align="right">Price / m²</Th>
            <Th align="right">Total</Th>
            <Th align="right">Down payment</Th>
          </tr>
        </thead>
        <tbody>
          {unit.options.map((o) => (
            <tr key={o.name} style={{ borderBottom: `1px solid ${LINE}` }}>
              <Td>
                <span style={{ color: INK, fontWeight: 600 }}>{o.name}</span>
                {o.description && (
                  <div style={{ color: MUTED, fontSize: 9.5, marginTop: 1 }}>{o.description}</div>
                )}
              </Td>
              <Td align="right">{o.pricePerSqm != null ? formatMoney(o.pricePerSqm, o.currency) : '—'}</Td>
              <Td align="right">
                {o.total != null
                  ? <span style={{ color: INK, fontWeight: 600 }}>{formatMoney(o.total, o.currency)}</span>
                  : '—'}
              </Td>
              <Td align="right">
                {o.downPayment != null
                  ? (o.downPayment <= 100 ? `${o.downPayment}%` : formatMoney(o.downPayment, o.currency))
                  : '—'}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '0 6px 5px',
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: MUTED,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td style={{ textAlign: align, padding: '6px', color: BODY, verticalAlign: 'top' }}>{children}</td>
}

// ── Payment plans ─────────────────────────────────────────────────────────────

function PaymentPlans({ p }: { p: Proposal }) {
  if (p.paymentPlans.length === 0) return null
  const base = p.investment.minInvestment ?? p.price?.amount ?? null
  const currency = p.price?.currency ?? 'USD'

  return (
    <Section title="Payment plans">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {p.paymentPlans.map((plan) => {
          // Turn a percentage and a month count into the two numbers a buyer
          // actually asks for: what now, and what per month.
          const schedule = base != null
            ? instalmentSchedule(base, plan.downPaymentPct, plan.months != null ? plan.months / 12 : null)
            : null
          return (
            <div
              key={plan.name}
              style={{
                ...noBreak,
                flex: '1 1 58mm',
                minWidth: '52mm',
                border: `1px solid ${LINE}`,
                borderRadius: 5,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{plan.name}</div>
              {plan.downPaymentPct != null && (
                <div style={{ fontSize: 10, color: BODY, marginTop: 3 }}>
                  {plan.downPaymentPct}% down
                  {plan.months ? ` · ${plan.months} monthly instalments` : ''}
                </div>
              )}
              {schedule && schedule.months > 0 && (
                <div style={{ fontSize: 10, color: INK, marginTop: 4, fontWeight: 600 }}>
                  {formatMoney(schedule.down, currency)} now, then{' '}
                  {formatMoney(schedule.monthly, currency)} / month
                </div>
              )}
              {plan.description && (
                <div style={{ fontSize: 9.5, color: MUTED, marginTop: 4 }}>{plan.description}</div>
              )}
            </div>
          )
        })}
      </div>
      {base != null && (
        <div style={{ fontSize: 9, color: MUTED, marginTop: 6 }}>
          Instalments calculated on {formatMoney(base, currency)}. Final figures are confirmed on reservation.
        </div>
      )}
    </Section>
  )
}

// ── Gallery, location, documents, contact ─────────────────────────────────────

function Gallery({ p }: { p: Proposal }) {
  if (p.gallery.length === 0) return null
  return (
    <Section title="Photographs">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {p.gallery.map((src, i) => (
          <div key={`${src}-${i}`} style={{ ...noBreak, borderRadius: 4, overflow: 'hidden', border: `1px solid ${LINE}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={normalizeFileUrl(src)}
              alt=""
              style={{ display: 'block', width: '100%', height: '52mm', objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}

function Location({ p }: { p: Proposal }) {
  if (!p.mapUrl && !p.virtualTourUrl) return null
  return (
    <Section title="Location & viewing">
      <div style={{ ...noBreak, fontSize: 10.5 }}>
        <Row label="Address" value={p.location} />
        {p.mapUrl && <Row label="Map" value={p.mapUrl} />}
        {p.virtualTourUrl && <Row label="Virtual tour" value={p.virtualTourUrl} />}
      </div>
    </Section>
  )
}

function Documents({ p }: { p: Proposal }) {
  if (p.documents.length === 0) return null
  return (
    <Section title="Documents" subtitle="Available on request, or at the links below.">
      <div style={{ ...noBreak, fontSize: 10.5 }}>
        {p.documents.map((d) => <Row key={d.id} label={d.type} value={d.title} />)}
      </div>
    </Section>
  )
}

function Contact({
  branding, generatedAt, p,
}: {
  branding: ProposalBranding
  generatedAt: string
  p: Proposal
}) {
  return (
    <footer style={{ ...noBreak, marginTop: 20, paddingTop: 12, borderTop: `1.5px solid ${INK}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{branding.companyName}</div>
          <div style={{ fontSize: 10.5, color: BODY, marginTop: 3 }}>
            {branding.phone} · {branding.email}
          </div>
          <div style={{ fontSize: 10.5, color: MUTED }}>{branding.website}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 9, color: MUTED, maxWidth: '95mm' }}>
          <div>
            Prepared {generatedAt}
            {p.reference && ` · ${p.reference}`}
          </div>
          <p style={{ margin: '5px 0 0', lineHeight: 1.45 }}>
            Prices, availability and projected returns are indicative and subject to change without
            notice. This document is for information only and does not form part of any offer or
            contract. Figures shown are not a guarantee of future performance.
          </p>
        </div>
      </div>
    </footer>
  )
}
