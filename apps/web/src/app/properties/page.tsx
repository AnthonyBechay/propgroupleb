import { redirect } from 'next/navigation'

export default function PropertiesPage() {
  // The catalog now lives on the homepage. Redirect straight there (the old
  // target, /listings, itself redirects to / — avoid the double hop).
  redirect('/')
}
