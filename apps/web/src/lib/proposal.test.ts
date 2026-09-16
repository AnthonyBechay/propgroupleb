import { describe, expect, it } from 'vitest'
import { buildProposal, instalmentSchedule, profileFor } from './proposal'

/** A Georgian off-plan unit: priced per m² through options, no listing. */
const georgiaProject = {
  id: 'b1',
  ref: 'PG-1059',
  title: 'Tonino Lamborghini Residences',
  country: 'GEORGIA',
  city: 'Batumi',
  status: 'OFF_PLAN',
  images: ['https://x/1.jpg', 'https://x/2.jpg'],
  hasPool: true,
  hasGym: true,
  highlightedFeatures: ['Sea view', 'Beachfront'],
  paymentPlans: [{ name: 'Instalments', kind: 'INSTALLMENTS', downPaymentPct: 30, months: 36 }],
  investmentData: {
    expectedROI: 14, rentalYield: 8, downPaymentPercentage: 30,
    installmentYears: 3, isGoldenVisaEligible: true, goldenVisaMinAmount: 100000,
    handoverDate: '2027-06-30T00:00:00.000Z',
  },
  units: [
    { id: 'u1', ref: 'PG-1059-1', kind: 'APARTMENT', areaSqm: 45, bedrooms: 1,
      options: [{ name: 'White frame', pricePerSqm: '4000', currency: 'USD' },
                { name: 'Turnkey', pricePerSqm: '4600', currency: 'USD' }],
      listings: [] },
  ],
  listings: [],
}

/** A Beirut apartment: one unit, priced by a live listing. */
const lebanonFlat = {
  id: 'b2',
  ref: 'PG-1042',
  title: 'Verdun Residences',
  country: 'LEBANON',
  city: 'Beirut',
  neighborhood: 'Verdun',
  mohafazat: 'BEIRUT',
  status: 'RESALE',
  images: ['https://x/a.jpg'],
  hasGenerator: true,
  hasElevator: true,
  units: [
    { id: 'u9', ref: 'PG-1042', kind: 'APARTMENT', areaSqm: 145, bedrooms: 2, bathrooms: 2, floor: 4,
      furnishing: 'FULLY_FURNISHED', views: ['SEA'], features: ['BALCONY'], options: [],
      listings: [{ id: 'l1', status: 'ACTIVE', visibility: 'PUBLIC', price: '285000', currency: 'USD', intent: 'FOR_SALE', negotiable: true }] },
  ],
  listings: [],
}

describe('profileFor', () => {
  it('sells Lebanon as a home and everywhere else as a return', () => {
    expect(profileFor('LEBANON')).toBe('residential')
    expect(profileFor('GEORGIA')).toBe('investment')
    expect(profileFor('CYPRUS')).toBe('investment')
    expect(profileFor(null)).toBe('residential')
  })
})

describe('buildProposal — Georgia', () => {
  const p = buildProposal(georgiaProject)

  it('is an investment document', () => {
    expect(p.profile).toBe('investment')
    expect(p.documentTitle).toBe('Investment Proposal')
  })

  it('derives the price from the cheapest finish, per m²', () => {
    // 45 m² x $4000 — the figure CLAUDE.md records as verified for PG-1059.
    expect(p.price?.amount).toBe(180000)
    expect(p.price?.source).toBe('option')
    // Two finishes to choose between, so it is a "from" price.
    expect(p.price?.prefix).toBe('From')
  })

  it('totals each finish against the unit area', () => {
    const opts = p.units[0].options
    expect(opts.map((o) => o.total)).toEqual([180000, 207000])
  })

  it('carries the investment case and residency', () => {
    expect(p.investment.hasAny).toBe(true)
    expect(p.investment.expectedROI).toBe(14)
    expect(p.investment.isGoldenVisaEligible).toBe(true)
    expect(p.investment.handoverDate).toBe('2027-06-30')
  })

  it('reads the location without inventing a country', () => {
    expect(p.location).toBe('Batumi, Georgia')
  })
})

describe('buildProposal — Lebanon', () => {
  const p = buildProposal(lebanonFlat)

  it('is a property document', () => {
    expect(p.profile).toBe('residential')
    expect(p.documentTitle).toBe('Property Proposal')
  })

  it('takes the price from the live listing', () => {
    expect(p.price?.amount).toBe(285000)
    expect(p.price?.source).toBe('listing')
    // One unit, one option — nothing to be "from".
    expect(p.price?.prefix).toBe('')
  })

  it('puts the sole unit’s specs on the cover', () => {
    const labels = p.facts.map((f) => f.label)
    expect(labels).toContain('Bedrooms')
    expect(labels).toContain('Floor')
    expect(p.facts.find((f) => f.label === 'Furnishing')?.value).toBe('Fully furnished')
    expect(p.facts.find((f) => f.label === 'View')?.value).toBe('Sea')
  })

  it('builds the full Lebanese location', () => {
    expect(p.location).toBe('Verdun, Beirut, Beirut, Lebanon')
  })

  it('lists only the amenities the building has', () => {
    expect(p.amenities).toEqual(['Elevator', 'Backup generator'])
  })
})

describe('buildProposal — scoping', () => {
  it('narrows to one unit when a share link says so', () => {
    const many = {
      ...georgiaProject,
      units: [
        georgiaProject.units[0],
        { id: 'u2', kind: 'APARTMENT', areaSqm: 90, options: [{ name: 'Turnkey', pricePerSqm: '4600', currency: 'USD' }], listings: [] },
      ],
    }
    expect(buildProposal(many).units).toHaveLength(2)
    expect(buildProposal(many, { unitId: 'u2' }).units).toHaveLength(1)
    // …and the price follows the scope: 90 x 4600.
    expect(buildProposal(many, { unitId: 'u2' }).price?.amount).toBe(414000)
  })

  it('says nothing rather than zero when there is no price', () => {
    const priceless = { ...lebanonFlat, units: [{ id: 'u0', kind: 'APARTMENT', options: [], listings: [] }] }
    expect(buildProposal(priceless).price).toBeNull()
  })

  it('ignores a draft listing, as the public site does', () => {
    const draft = {
      ...lebanonFlat,
      units: [{ ...lebanonFlat.units[0], listings: [{ id: 'l2', status: 'DRAFT', visibility: 'PUBLIC', price: '999000', currency: 'USD', intent: 'FOR_SALE' }] }],
    }
    expect(buildProposal(draft).price).toBeNull()
  })
})

describe('instalmentSchedule', () => {
  it('turns a percentage and a term into what you pay now and monthly', () => {
    expect(instalmentSchedule(180000, 30, 3)).toEqual({
      down: 54000, downPct: 30, balance: 126000, months: 36, monthly: 3500,
    })
  })

  it('returns nothing when there is no plan to describe', () => {
    expect(instalmentSchedule(180000, null, null)).toBeNull()
    expect(instalmentSchedule(0, 30, 3)).toBeNull()
  })
})
