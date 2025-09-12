"use client";
import { ArrowRight, Rocket, ShieldCheck, Zap, CheckCircle, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CtcBanner() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const pathname = usePathname();

  // Route flags
  const isBrands = pathname === "/brands";
  const isCreators = pathname === "/creators";
  const isHome = pathname === "/";

  // Styles
  const styles = {
    creators: {
      bgGradient:
        "linear-gradient(180deg, #161C34 0%, rgba(231, 93, 13, 0.56) 166.78%)",
      circleColor: "border-orange-500",
      arcColor: "border-t-orange-500",
      textGradient: "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
      btnGradient: "linear-gradient(90deg, #DD7209 0%, #FF652D 100%)",
    },
    brands: {
      bgGradient: "linear-gradient(180deg, #161C34 0%, #7F39EC 166.78%)",
      circleColor: "border-purple-500",
      arcColor: "border-t-purple-500",
      textGradient: "linear-gradient(180deg, #B16FF4 33.29%, #7F39EC 81.2%)",
      btnGradient: "linear-gradient(90deg, #7F39EC 0%, #B16FF4 100%)",
    },
  };

  // Theme selection: / and /brands share the brands theme
  const theme = isCreators ? styles.creators : styles.brands;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setInView(true);
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  return (
    <section
      className="relative flex flex-col items-center justify-center min-h-[500px] text-center text-white overflow-hidden"
      ref={sectionRef}
      style={{ background: theme.bgGradient }}
    >
      {/* Background Rings */}
      <div
        className={`absolute w-[500px] h-[500px] border ${theme.circleColor}/20 rounded-full`}
      ></div>
      <div
        className={`absolute w-[700px] h-[700px] border ${theme.circleColor}/20 rounded-full`}
      ></div>
      <div
        className={`absolute w-[900px] h-[900px] border ${theme.circleColor}/20 rounded-full`}
      ></div>

      {/* Revolving arc */}
      <div className="absolute w-[900px] h-[900px] rounded-full animate-spin-slow">
        <div
          className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme.arcColor}`}
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)" }}
        ></div>
      </div>
      <div className="absolute w-[700px] h-[700px] rounded-full animate-spin-slow-reverse">
        <div
          className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme.arcColor}`}
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)" }}
        ></div>
      </div>

      {/* Tagline */}
      <div className="flex items-center mt-3 md:mt-0 gap-2 px-4 py-2 bg-[#2C3148] rounded-full text-lg z-10">
        <Rocket className="w-4 h-4" />
        <span>
          {isHome
            ? "Ready to go viral?"
            : isBrands
              ? "Ready to go viral?"
              : "Ready to get paid?"}
        </span>
      </div>

      {/* Main Heading */}
      <h1
        className={`mt-6 text-3xl md:text-5xl font-bold z-10 ${inView ? "slide-up" : "opacity-0 translate-y-10"
          }`}
      >
        {isHome
          ? "Join the "
          : "Ready to Transform Your "}{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: theme.textGradient }}
        >
          {isCreators
            ? "Creativity"
            : isHome
              ? "Creator Revolutions "
              : "Content Strategy"}
        </span>
        ?
      </h1>

      {/* Subtitle */}
      <p
        className={`mt-4 max-w-2xl text-xl text-gray-200 z-10 ${inView ? "slide-left" : "opacity-0 translate-x-10"
          }`}
      >
        {isHome
          ? "50,000+ creators, 1000+ brands, millions of viral moments. Your turn to dominate!"
          : isCreators
            ? "Join thousands of creators and brands. Sign up today and unlock your potential!"
            : "Launch your first contest today and witness the power of creator-generated content."}
      </p>

      {/* CTA Button */}
      <div className="flex justify-center items-center mt-12">
        
         
          <Link
            href="/auth/signup"
            className="relative z-10 flex items-center gap-2"
            onClick={() => {
              // Store user role based on current page
              if (isHome) {
                // For home page, don't set a specific role - let user choose
                localStorage.removeItem('signupRole');
              } else if (isCreators) {
                localStorage.setItem('signupRole', 'creator');
              } else {
                // For brands page
                localStorage.setItem('signupRole', 'brand');
              }
            }}
            className="rounded-3xl relative text-white font-bold px-8 py-3 text-lg overflow-hidden flex items-center gap-2"
            style={{ backgroundImage: theme.btnGradient }}
          >
             <div className="scan-line"></div>
            <Rocket className="w-4 h-4" />
            {isHome
              ? "Join Game Of Creators"
              : isCreators
                ? "Participate in a Contest"
                : "Launch a Contest"}
            <ArrowRight className="h-5 w-5" />
          </Link>
       
      </div>

      {/* Feature Buttons for Home */}
      {isHome && (
        <div className="flex flex-wrap justify-center gap-6 mt-12 z-10">
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <ShieldCheck className="w-4 h-4" /> 100% Secure
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <Zap className="w-4 h-4" /> Instant Setup
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <CheckCircle className="w-4 h-4" /> Guaranteed Results
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <Globe className="w-4 h-4" /> Global Reach
          </div>
        </div>
      )}
    </section>
  );
}
