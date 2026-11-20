import { Hero } from '../components/home/Hero'
import { ProcessSection } from '../components/home/ProcessSection'
import { Categories, Featured, Marquee, Perks, ProjectsTeaser } from '../components/home/Sections'

export default function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Categories />
      <Featured />
      <ProcessSection />
      <ProjectsTeaser />
      <Perks />
    </>
  )
}
