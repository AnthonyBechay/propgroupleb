import Link from 'next/link'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const CONTACT_EMAIL = 'propgroupleb@gmail.com'
const LAST_UPDATED = '17 October 2026'

export const metadata = {
  title: 'Privacy Policy — PropGroup',
  description:
    'How PropGroup collects, uses and protects your personal data, and how to ask us to delete it.',
  alternates: { canonical: `${SITE_URL}/privacy` },
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-3 text-slate-700 leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="space-y-10">
          <Section id="who-we-are" title="1. Who we are">
            <p>
              PropGroup is a real estate brokerage. We operate the websites propgrouplb.com and
              propgrp.com, and we talk to clients by phone, email, WhatsApp, Instagram and Facebook.
              This policy explains what personal data we hold about you when you use any of them,
              why we hold it, and how you can have it corrected or deleted.
            </p>
            <p>
              For anything in this policy, write to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-slate-900">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section id="what-we-collect" title="2. What we collect">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>What you send us through the website.</strong> Your name, email, phone
                number and message when you fill in a contact form, enquire about a property, or
                submit a property to list.
              </li>
              <li>
                <strong>Your account.</strong> If you create an account: your name, email, a hashed
                password (or your Google account identifier if you sign in with Google), and the
                properties you save.
              </li>
              <li>
                <strong>Messages on WhatsApp and Instagram.</strong> When you message our business
                number or Instagram account, we receive your phone number or Instagram identifier,
                your profile name, and the content of the conversation. If you reached us by tapping
                an advert, we also receive which advert it was.
              </li>
              <li>
                <strong>Facebook and Instagram lead forms.</strong> If you submit one of our lead
                forms on Facebook or Instagram, Meta passes us the answers you entered — typically
                your name, phone number, email and what you are looking for.
              </li>
              <li>
                <strong>What you tell our team.</strong> Your budget, preferred areas, the properties
                you have viewed, and notes from calls and meetings.
              </li>
              <li>
                <strong>Usage data.</strong> Pages viewed, approximate location derived from your IP
                address, and device and browser type.
              </li>
            </ul>
          </Section>

          <Section id="how-we-use-it" title="3. How we use it">
            <ul className="list-disc pl-5 space-y-2">
              <li>To reply to your enquiry and keep a record of our conversation with you.</li>
              <li>To suggest properties that match what you asked for, and to arrange viewings.</li>
              <li>To carry out a sale, purchase or rental you have asked us to handle.</li>
              <li>To run your account and keep it secure.</li>
              <li>To understand which adverts and pages lead to enquiries, and improve them.</li>
            </ul>
            <p>
              We may use automated tools to help draft or send replies to messages. A member of our
              team can always take over the conversation, and you can ask to speak to a person at
              any time.
            </p>
            <p>We do not sell your personal data, and we do not share it for other companies&apos; advertising.</p>
          </Section>

          <Section id="who-we-share-it-with" title="4. Who we share it with">
            <p>We share personal data only where it is needed to provide our service:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Property owners, developers and buyers</strong> — only as far as needed to
                arrange a viewing or complete a transaction you have asked for.
              </li>
              <li>
                <strong>Service providers that process data on our behalf</strong> — Meta Platforms
                (WhatsApp, Instagram and Facebook messaging and lead forms), Google (sign-in),
                Cloudflare (hosting, storage and security), our email delivery provider, and
                providers of automated-reply tools.
              </li>
              <li>
                <strong>Authorities</strong> — where the law requires it.
              </li>
            </ul>
          </Section>

          <Section id="retention" title="5. How long we keep it">
            <p>
              We keep client records and conversations for as long as we have an active relationship
              with you, and afterwards for as long as we are legally required to keep transaction
              records. You can ask us to delete your data sooner — see below.
            </p>
          </Section>

          <Section id="cookies" title="6. Cookies">
            <p>
              We use a cookie to keep you signed in to your account, and basic analytics to count
              page views. We also use the Meta Pixel, which tells Meta (Facebook and Instagram) which
              of our pages you visited and whether you sent us an enquiry, so that we can measure our
              adverts and show them to people likely to be interested. You can control this in your
              Facebook and Instagram ad settings.
            </p>
          </Section>

          <Section id="your-rights" title="7. Your rights">
            <p>
              You can ask us for a copy of the personal data we hold about you, ask us to correct
              it, ask us to stop contacting you, or ask us to delete it. Write to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-slate-900">
                {CONTACT_EMAIL}
              </a>{' '}
              and we will respond within 30 days.
            </p>
          </Section>

          <Section id="data-deletion" title="8. How to delete your data">
            <p>
              To have your personal data deleted — including anything we received through WhatsApp,
              Instagram, Facebook or a lead form:
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Email{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Data%20deletion%20request`}
                  className="underline hover:text-slate-900"
                >
                  {CONTACT_EMAIL}
                </a>{' '}
                with the subject <strong>&ldquo;Data deletion request&rdquo;</strong>.
              </li>
              <li>
                Tell us the phone number, email address or Instagram username you used to contact
                us, so we can find your records.
              </li>
              <li>
                We will delete your contact details, your conversation history and your account (if
                you have one) within 30 days, and confirm to you by email once it is done.
              </li>
            </ol>
            <p>
              We may keep records we are legally required to retain, such as documents relating to a
              completed sale or rental. We will tell you if that applies to you.
            </p>
            <p>
              You can also stop us receiving new data at any time by blocking our number on WhatsApp
              or our account on Instagram.
            </p>
          </Section>

          <Section id="changes" title="9. Changes to this policy">
            <p>
              If we change this policy we will update the date at the top of this page. Significant
              changes will be highlighted on our website.
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <Link href="/" className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
