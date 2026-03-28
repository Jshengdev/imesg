'use client'
import { useState } from 'react'

export function FooterSection() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <section className="footer-section" id="waitlist">
      <div className="footer-eyebrow">Private beta</div>
      <h2 className="footer-headline">Nudge is in private beta.</h2>
      <p className="footer-sub">Leave your email and we&apos;ll be in touch when a spot opens up.</p>
      <form className="waitlist-form" onSubmit={handleSubmit}>
        <input className="waitlist-input" type="email" placeholder="your@email.com" required />
        <button className="btn-blue" type="submit">request access</button>
      </form>
      <p className="footer-note" style={{ opacity: submitted ? 1 : 0, transition: 'opacity 0.3s' }}>
        you&apos;re on the list &#x2713;
      </p>
    </section>
  )
}
