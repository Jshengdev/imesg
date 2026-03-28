import { DemoSection } from '@/components/DemoSection'
import { ProblemSection } from '@/components/ProblemSection'
import { HowSection } from '@/components/HowSection'
import { MomentsSection } from '@/components/MomentsSection'
import { CloserSection } from '@/components/CloserSection'

export default function Home() {
  return (
    <main>
      <DemoSection />
      <ProblemSection />
      <HowSection />
      <MomentsSection />
      <CloserSection />
    </main>
  )
}
