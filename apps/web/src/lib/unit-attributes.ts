/**
 * What a unit *has* — its outlook, its features, how it's furnished and owned.
 *
 * `Unit.views` and `Unit.features` are plain `String[]` columns with no enum
 * behind them, and the back office never offered an input for either, so what
 * is in the database is whatever the Georgian import wrote: `UPPER_SNAKE`
 * tokens. The public listing page prints `features` verbatim, which would show
 * a buyer "MAID_ROOM".
 *
 * So: views stay tokens (the proposal export already lowercases them into
 * "sea / city view"), features are captured as readable text going forward, and
 * `prettyAttr` renders either shape correctly wherever one is displayed.
 */

export const VIEW_OPTIONS = [
  { value: 'SEA', label: 'Sea' },
  { value: 'MOUNTAIN', label: 'Mountain' },
  { value: 'CITY', label: 'City' },
  { value: 'GARDEN', label: 'Garden' },
  { value: 'POOL', label: 'Pool' },
  { value: 'STREET', label: 'Street' },
  { value: 'OPEN', label: 'Open' },
]

/** Offered as one-tap chips so the same feature isn't typed three ways. */
export const FEATURE_SUGGESTIONS = [
  'Balcony', 'Terrace', 'Maid’s room', 'Storage room', 'Private entrance',
  'Open kitchen', 'Walk-in closet', 'Fireplace', 'Jacuzzi', 'Private garden',
  'Corner unit', 'Double height ceiling',
]

export const FURNISHING_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'UNFURNISHED', label: 'Unfurnished' },
  { value: 'SEMI_FURNISHED', label: 'Semi-furnished' },
  { value: 'FULLY_FURNISHED', label: 'Fully furnished' },
]

export const OWNERSHIP_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'FREEHOLD', label: 'Freehold' },
  { value: 'LEASEHOLD', label: 'Leasehold' },
]

/**
 * Render a stored attribute for a human.
 *
 * `MAID_ROOM` → `Maid room`; text already written by hand is left alone, so a
 * carefully typed "Maid's room" doesn't get mangled on its way to the page.
 */
export function prettyAttr(value: string): string {
  if (!/^[A-Z0-9_]+$/.test(value)) return value
  const words = value.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
