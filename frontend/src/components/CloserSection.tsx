'use client'
import { useReveal } from '@/hooks/useReveal'

export function CloserSection() {
  const { ref: r1, revealed: v1 } = useReveal()
  const { ref: r2, revealed: v2 } = useReveal()
  const { ref: r3, revealed: v3 } = useReveal()
  const { ref: rSub, revealed: vSub } = useReveal()

  const lineStyle = (revealed: boolean, delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'none' : 'translateY(16px)',
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  })

  return (
    <section className="closer-section" id="closer">
      <div className="closer-lines">
        <div ref={r1} className="closer-line" style={lineStyle(v1, 0)}>No app.</div>
        <div ref={r2} className="closer-line" style={lineStyle(v2, 0.08)}>No dashboard.</div>
      </div>
      <p ref={rSub} className="closer-sub" style={{
        opacity: vSub ? 1 : 0,
        transform: vSub ? 'none' : 'translateY(10px)',
        transition: 'opacity 0.5s ease 0.28s, transform 0.5s ease 0.28s',
      }}>
        It lives in your iMessage.<br/>
        It talks to you before you think to ask.
      </p>
    </section>
  )
}
