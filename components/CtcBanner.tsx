"use client";
import { ArrowRight, Rocket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CtcBanner() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const pathname = usePathname();

  // Colors based on route
  const isBrands = pathname === "/brands";
  const isCreators = pathname === "/creators";

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

  const theme = isBrands ? styles.brands : styles.creators;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

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
      <div className="flex items-center gap-2 px-4 py-2 bg-[#2C3148] rounded-full text-lg z-10">
        <Rocket className="w-4 h-4" />
        <span>Read to go viral?</span>
      </div>

      {/* Main Heading */}
      <h1
        className={`mt-6 text-3xl md:text-5xl font-bold z-10 ${
          inView ? "slide-up" : "opacity-0 translate-y-10"
        }`}
      >
        Ready to Transform Your{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: theme.textGradient }}
        >
          {isBrands ? "Content Strategy" : "Creativity"}
        </span>
        ?
      </h1>

      {/* Subtitle */}
      <p
        className={`mt-4 max-w-2xl text-xl text-gray-200 z-10 ${
          inView ? "slide-left" : "opacity-0 translate-x-10"
        }`}
      >
       {isBrands
    ? "Launch your first contest today and witness the power of creator-generated content."
    : "Join thousands of creators and brands. Sign up today and unlock your potential!"}
      </p>

      {/* CTA Button */}
      <div className="flex justify-center items-center mt-12">
      <button className="rounded-3xl relative text-white text-white font-bold px-8 py-3 text-lg overflow-hidden"  style={{ backgroundImage: theme.btnGradient }}>
     
       <div className="scan-line"></div>
      <Link
        href="/auth/signup"
        className="relative z-10 flex items-center gap-2"
        
      >
       
        <Rocket className="w-4 h-4" />
        {isBrands ? "Launch a contest" : "Join Game Of Creators"}
        <ArrowRight className="h-5 w-5" />
      </Link>
      </button>
      </div>
    </section>
  );
}
