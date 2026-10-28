import { redirect } from 'next/navigation'

// Moved under Settings; kept so old bookmarks and links still land.
export default function AiSettingsMoved() {
  redirect('/admin/settings/assistant')
}
