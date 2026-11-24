'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'

/**
 * Getting a signed viewing agreement to the client, from a phone.
 *
 * `window.print()` is not an option: an iPhone Home Screen app ignores it, so
 * the old "Print / PDF" button did nothing there. The server renders a real PDF
 * instead (`GET /api/viewing-agreements/:id/pdf`), and the phone's share sheet
 * sends it — WhatsApp, Mail, Save to Files and Print are all in that sheet.
 *
 * Safari only opens the share sheet from a tap that is still "fresh", and an
 * `await fetch()` in between uses that up. So the PDF is fetched when the page
 * opens (`useAgreementPdf`) and the tap calls `share()` straight away.
 */

export interface AgreementShareInfo {
  id: string
  ref: string
  clientName: string
  clientPhone: string | null
}

export function pdfFileName(ref: string): string {
  return `PropGroup-viewing-agreement-${ref}.pdf`
}

/** Preload the PDF so a tap can share it synchronously. */
export function useAgreementPdf(id: string | null | undefined) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!id) return
    let live = true
    setFile(null)
    setError(null)
    apiClient
      .getViewingAgreementPdf(id)
      .then((blob) => {
        if (!live) return
        // The ref is in the server's filename; the blob alone doesn't carry it.
        setFile(new File([blob], `agreement-${id}.pdf`, { type: 'application/pdf' }))
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not create the PDF'))
    return () => { live = false }
  }, [id, nonce])

  return { file, error, retry: () => setNonce((n) => n + 1) }
}

function named(file: File, ref: string): File {
  return new File([file], pdfFileName(ref), { type: 'application/pdf' })
}

/** Can this device share a PDF through its share sheet (phones, tablets, some desktops)? */
export function canShareFiles(file: File | null): boolean {
  if (!file || typeof navigator === 'undefined' || !navigator.canShare) return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

/** The message that goes with the PDF. */
export function whatsappMessage(a: AgreementShareInfo): string {
  const first = a.clientName.trim().split(/\s+/)[0] || ''
  return `Hello ${first}, here is your signed PropGroup viewing agreement (${a.ref}). Thank you for visiting with us.`
}

/**
 * A wa.me link to the client's own chat. A number typed in local form
 * ("03 212 385") has no country code, and wa.me would open the wrong person,
 * so those open WhatsApp's contact picker instead.
 */
export function whatsappLink(a: AgreementShareInfo): string {
  const text = encodeURIComponent(whatsappMessage(a))
  const raw = (a.clientPhone || '').trim()
  const international = raw.startsWith('+') || raw.startsWith('00')
  const digits = raw.replace(/\D/g, '').replace(/^00/, '')
  return international && digits.length >= 8 ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`
}

export function downloadFile(file: File, ref: string) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = pdfFileName(ref)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export type ShareOutcome = 'shared' | 'cancelled' | 'fallback'

/**
 * Send the PDF through the share sheet (pick WhatsApp there). Where the device
 * can't share files — most desktops — download the PDF and open the client's
 * WhatsApp chat with the message ready, so it only needs attaching.
 */
export async function sharePdfViaWhatsApp(file: File, a: AgreementShareInfo): Promise<ShareOutcome> {
  const pdf = named(file, a.ref)
  if (canShareFiles(pdf)) {
    try {
      await navigator.share({ files: [pdf], title: `Viewing agreement ${a.ref}`, text: whatsappMessage(a) })
      return 'shared'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
      // NotAllowedError and friends: fall through to the link.
    }
  }
  downloadFile(pdf, a.ref)
  window.open(whatsappLink(a), '_blank', 'noopener')
  return 'fallback'
}

/**
 * "Save PDF": on a phone the share sheet is the way to save or print (an
 * installed iPhone app can't download a file any other way); elsewhere, a
 * plain download.
 */
export async function savePdf(file: File, ref: string): Promise<void> {
  const pdf = named(file, ref)
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (touch && canShareFiles(pdf)) {
    try {
      await navigator.share({ files: [pdf], title: `Viewing agreement ${ref}` })
      return
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return
    }
  }
  downloadFile(pdf, ref)
}
