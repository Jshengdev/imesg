'use client'
import { useReveal } from '@/hooks/useReveal'

const ROWS = [
  { label: 'Your calendar', verb: 'knows', what: 'WHEN.' },
  { label: 'Your email',    verb: 'knows', what: 'WHAT.' },
  { label: 'Your texts',    verb: 'know',  what: 'WHO.'  },
]

function ProblemRow({ label, verb, what, delay = 0 }: { label: string; verb: string; what: string; delay?: number }) {
  const { ref, revealed } = useReveal()
  return (
    <div
      ref={ref}
      className="problem-row"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'none' : 'translateY(16px)',
        transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
      }}
    >
      <span className="problem-label">{label}</span>
      <span className="problem-knows">{verb}</span>
      <span className="problem-what">{what}</span>
    </div>
  )
}

function PunchLine() {
  const { ref, revealed } = useReveal()
  return (
    <p
      ref={ref}
      className="problem-punch"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'none' : 'translateY(12px)',
        transition: 'opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s',
      }}
    >
      But nothing tells you what to do, in what order, right now.
    </p>
  )
}

export function ProblemSection() {
  return (
    <section className="section" id="problem">
      <div className="section-inner">
        <div className="problem-grid">
          {ROWS.map((row, i) => (
            <ProblemRow key={row.what} {...row} delay={i * 0.1} />
          ))}
        </div>
        <PunchLine />
      </div>
    </section>
  )
}
