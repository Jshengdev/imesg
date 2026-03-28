'use client'
import { useReveal } from '@/hooks/useReveal'

const MOMENTS = [
  { when: 'every morning, before you check anything', bubble: 'morning. sarah emailed about the budget twice. <em>i\'d reply before your 2pm.</em>' },
  { when: 'send a photo. get an answer.', bubble: 'Whiteboard, receipt, menu — Nudge reads it and responds in voice.' },
  { when: 'the follow-up you forgot', bubble: 'you told kayla you\'d send the deck 2 days ago. <em>want me to draft something?</em>' },
]

function MomentItem({ when, bubble, delay = 0 }: { when: string; bubble: string; delay?: number }) {
  const { ref, revealed } = useReveal()
  return (
    <div ref={ref} className="moment-item" style={{
      opacity: revealed ? 1 : 0,
      transform: revealed ? 'none' : 'translateY(14px)',
      transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
    }}>
      <div className="moment-when">{when}</div>
      <div className="moment-bubble" dangerouslySetInnerHTML={{ __html: bubble }} />
    </div>
  )
}

export function MomentsSection() {
  return (
    <section className="section" id="moments">
      <div className="section-inner">
        <div className="moments-header">What it sounds like</div>
        <div className="moments-list">
          {MOMENTS.map((m, i) => (
            <MomentItem key={m.when} {...m} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  )
}
