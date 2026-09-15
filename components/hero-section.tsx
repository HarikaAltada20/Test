import CtcBanner from "./CtcBanner";
import HeroContent from "./hero-content";

export function HeroSection() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#000825] text-white">
      <div className="relative z-20 w-full">
        <HeroContent />
        <CtcBanner />
      </div>
    </div>
  );
}
