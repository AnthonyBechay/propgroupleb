/**
 * The PropGroup viewing & introduction agreement — the text a client signs on
 * an agent's phone or tablet before being shown a property.
 *
 * This file is the only copy of the terms. The form fetches them from
 * `GET /api/viewing-agreements/terms` and the server re-renders them itself at
 * signing time (it never trusts text posted by the browser), then stores the
 * rendered text on the agreement. So changing anything here only affects
 * agreements signed after the deploy.
 *
 * **Bump `VIEWING_TERMS_VERSION` whenever the wording changes**, so every
 * signed record says which version it was.
 *
 * Not legal advice: have the wording reviewed by the office's lawyer for each
 * market before relying on it in a dispute.
 */

export const VIEWING_TERMS_VERSION = '2026-11-23.2';

/** PropGroup's fee on a purchase, as a percent of the final price. */
export const VIEWING_FEE_PERCENT = 2.5;

/** How long after the viewing the introduction stays protected. */
export const VIEWING_PROTECTION_MONTHS = 12;

export interface TermsSection {
  title: string;
  body: string;
}

export function viewingTermsSections(
  feePercent = VIEWING_FEE_PERCENT,
  months = VIEWING_PROTECTION_MONTHS
): TermsSection[] {
  const fee = `${feePercent}%`;
  return [
    {
      title: 'Introduction by PropGroup',
      body:
        'The client confirms that the property or properties listed in this agreement were introduced and shown to them by PropGroup and its agent named below, on the date of this agreement.',
    },
    {
      title: 'No direct dealing',
      body:
        `For ${months} months from the date of this agreement, the client will not contact, negotiate with, make an offer to, or buy from the owner, the developer, or any of their representatives, directly or through another agent or intermediary, for any property listed here, without PropGroup. All communication and negotiation about these properties goes through PropGroup.`,
    },
    {
      title: `PropGroup's fee: ${fee}`,
      body:
        `If the client buys any property listed here within that period, the client pays PropGroup a fee of ${fee} of the final purchase price. The fee is due on the signing of the first reservation, deposit, promise-of-sale or sale contract, whichever comes first.`,
    },
    {
      title: 'Purchases by related parties',
      body:
        "The fee is also owed if the property is bought by the client's spouse, a family member, a business partner, a company the client controls or has an interest in, or anyone else acting on the client's behalf or on information the client obtained through PropGroup.",
    },
    {
      title: 'Going around PropGroup',
      body:
        `If the client buys a listed property in breach of the no-direct-dealing rule, the full ${fee} fee is still owed, together with any reasonable costs PropGroup incurs to recover it.`,
    },
    {
      title: 'Earlier introductions',
      body:
        'If another agent or the owner introduced the client to a listed property before today, the client must say so now, before signing. Otherwise the client confirms that PropGroup is the first to introduce them to each property listed here.',
    },
    {
      title: 'Information about the property',
      body:
        "Prices, areas, plans and other details are given in good faith from the owner's or developer's information and may change. The client should verify them, including the legal title, before buying. PropGroup is not liable for information supplied by third parties.",
    },
    {
      title: 'Confidentiality',
      body:
        "The client will not share the property's address, the owner's details or the price information given by PropGroup with any third party.",
    },
    {
      title: 'During the viewing',
      body:
        "The client stays with the PropGroup agent during the viewing, respects the property and its occupants, and does not take photos or videos without the agent's permission. The client is responsible for any damage they cause.",
    },
    {
      title: 'Personal data',
      body:
        "The client's details and signature are kept by PropGroup to record this agreement and to follow up on the client's property search. They are not sold or shared for marketing.",
    },
    {
      title: 'Electronic signature',
      body:
        'The client agrees that signing on screen is as binding as a handwritten signature, and that a copy of this agreement can be provided on request.',
    },
    {
      title: 'Applicable law',
      body:
        'This agreement is governed by the laws of the country where the property is located, and its courts have jurisdiction over any dispute.',
    },
  ];
}

/** The terms as one plain-text block — what is stored on the signed record. */
export function renderViewingTerms(
  feePercent = VIEWING_FEE_PERCENT,
  months = VIEWING_PROTECTION_MONTHS
): string {
  return viewingTermsSections(feePercent, months)
    .map((s, i) => `${i + 1}. ${s.title}\n${s.body}`)
    .join('\n\n');
}
