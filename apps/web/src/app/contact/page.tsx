import { redirect } from 'next/navigation'

// Contact has been merged into the About page (single informative page).
export default function ContactRedirect() {
  redirect('/about#contact')
}
