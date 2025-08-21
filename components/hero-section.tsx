import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import CtcBanner from "./CtcBanner";
import NumbersSection from "./NumberSection";
import HeroContent from "./hero-content";

export function HeroSection() {
  return (
    <div className="relative min-h-screen bg-[#000825] text-white overflow-hidden">
      {/* Refined Background Elements - More Subtle */}
      <div className="relative z-20">
      
        <HeroContent />
        <Testimonials />
        <FAQ />
        <CtcBanner />
      </div>
    </div>
  );
}
