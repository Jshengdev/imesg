import { HeroSection } from '@/components/HeroSection'
import { DemoSection } from '@/components/DemoSection'
import { ProblemSection } from '@/components/ProblemSection'
import { HowSection } from '@/components/HowSection'
import { MomentsSection } from '@/components/MomentsSection'
import { CloserSection } from '@/components/CloserSection'
import { FooterSection } from '@/components/FooterSection'

export default function Home() {
  return (
    <main>
      <HeroSection />
      <DemoSection />
      <ProblemSection />
      <HowSection />
      <MomentsSection />
      <CloserSection />
      <FooterSection />
    </main>
  )
}
