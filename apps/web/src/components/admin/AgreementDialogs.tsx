'use client'

import { ConfirmDialog } from '@/components/admin/ui/ConfirmDialog'

export function StatusPill({ status }: { status: 'SIGNED' | 'VOID' }) {
  return status === 'VOID' ? (
    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">VOID</span>
  ) : (
    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">SIGNED</span>
  )
}

/** Shared by the list and the agreement page. */
export function DeleteAgreementDialog({
  agreement, busy, error, onConfirm, onClose,
}: {
  agreement: { ref: string; clientName: string } | null
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      open={!!agreement}
      tone="danger"
      busy={busy}
      title="Delete this agreement?"
      description={
        <>
          {agreement ? <><span className="font-mono">{agreement.ref}</span> — {agreement.clientName}</> : null}
          {error && <span className="mt-2 block text-red-600">{error}</span>}
        </>
      }
      consequences={[
        'The agreement and the client’s signature are removed from the database.',
        'A PDF already sent to the client stays on their phone.',
        'To keep a record but cancel it, void it instead.',
        'This cannot be undone.',
      ]}
      requireText={agreement?.ref}
      confirmLabel="Delete for good"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
