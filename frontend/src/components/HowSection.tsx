'use client'
import { useReveal } from '@/hooks/useReveal'

function HowCard({ tag, title, desc, delay = 0 }: { tag: string; title: string; desc: string; delay?: number }) {
  const { ref, revealed } = useReveal()
  return (
    <div ref={ref} className="how-card" style={{
      opacity: revealed ? 1 : 0,
      transform: revealed ? 'none' : 'translateY(14px)',
      transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
    }}>
      <div className="how-card-tag">{tag}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  )
}

export function HowSection() {
  const { ref, revealed } = useReveal()
  return (
    <section className="section" id="how">
      <div className="section-inner">
        <div className="how-header">Two parts. Both invisible.</div>
        <div className="how-grid">
          <HowCard tag="Part one" title="The Listener" desc="Silently reads every text and pulls out what matters — tasks, commitments, asks, deadlines, plans. It never sends a message to anyone. You'll never know it's there." />
          <HowCard tag="Part two" title="The Agent" desc="Connects everything the Listener learned to your calendar and email — and tells you, in voice, what to do next." delay={0.12} />
        </div>
        <p ref={ref} className="how-footnote" style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'none' : 'translateY(10px)',
          transition: 'opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s',
        }}>The Listener is the ears. The Agent is the brain and mouth.</p>
      </div>
    </section>
  )
}
