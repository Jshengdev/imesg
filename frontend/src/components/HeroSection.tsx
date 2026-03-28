export function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-logo">
        <div className="hero-logo-mark"></div>
        <span className="hero-wordmark">Nudge</span>
      </div>
      <p className="hero-sub">Your texts, your email, your calendar.<br/>One friend who actually pays attention.</p>
      <div className="scroll-cue">
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
          <rect x="1" y="1" width="12" height="18" rx="6" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2"/>
          <circle cx="7" cy="6" r="1.5" fill="rgba(0,0,0,0.18)">
            <animate attributeName="cy" values="6;11;6" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>
          </circle>
        </svg>
        scroll to see it work
      </div>
    </section>
  )
}
