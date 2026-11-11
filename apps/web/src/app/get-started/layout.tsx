import type { Metadata } from 'next'

// The page itself is a client component, which cannot export metadata — so it
// was indexed under the homepage's title and description.
export const metadata: Metadata = {
  title: 'Get Started — Buy, Sell or Rent Property in Lebanon',
  description: 'Tell PropGroup what you are looking for in Lebanon — buying, selling, renting or renting out — and a broker will come back with matching properties.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
