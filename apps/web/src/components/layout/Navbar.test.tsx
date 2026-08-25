import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Navbar } from './Navbar'

// Mock the auth context
const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}))

// The navbar reads the current route to decide which shortcuts to offer.
// Without this mock `usePathname()` returns null and the component throws —
// which is what these tests were doing before, silently, for three of five cases.
const mockPathname = vi.fn(() => '/')

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname()
}))

// Mock Next.js components
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}))

vi.mock('next/image', () => ({
  // `priority`/`fill` are next/image directives, not DOM attributes — drop them
  // so React doesn't warn about unknown props on a plain <img>.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, priority: _p, fill: _f, ...props }: any) => <img alt={alt ?? ''} {...props} />
}))

// Mock the AuthModal component
vi.mock('@/components/auth/AuthModal', () => ({
  AuthModal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-modal">{children}</div>
  )
}))

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue('/')
  })

  it('should render the wordmark and the primary navigation links', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() })

    render(<Navbar />)

    expect(screen.getByText('PropGroup')).toBeInTheDocument()
    // Each link renders twice — once for desktop, once inside the mobile panel.
    expect(screen.getAllByText('Properties').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ROI Calculator').length).toBeGreaterThan(0)
  })

  it('should show sign-in affordances when nobody is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() })

    render(<Navbar />)

    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getAllByTestId('auth-modal').length).toBeGreaterThan(0)
  })

  it('should show the user and their portal shortcut when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com', role: 'USER' },
      loading: false,
      signOut: vi.fn()
    })

    render(<Navbar />)

    expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0)
    expect(screen.getByText('Portal')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('should offer the back office to an admin and withhold it from a plain user', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'boss@example.com', role: 'ADMIN' },
      loading: false,
      signOut: vi.fn()
    })
    const { unmount } = render(<Navbar />)
    expect(screen.getAllByText('Admin Panel').length).toBeGreaterThan(0)
    unmount()

    mockUseAuth.mockReturnValue({
      user: { email: 'buyer@example.com', role: 'USER' },
      loading: false,
      signOut: vi.fn()
    })
    render(<Navbar />)
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
  })

  it('should show loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: vi.fn() })

    render(<Navbar />)

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('should render mobile menu button', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() })

    render(<Navbar />)

    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })
})
