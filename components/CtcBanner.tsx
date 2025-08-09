// components/CtcBanner.tsx
import { ArrowRight, Rocket } from "lucide-react";
import Link from "next/link";
export default function CtcBanner() {
  return (
    <section
      className="relative flex flex-col items-center justify-center min-h-[500px] text-center text-white overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #161C34 0%, rgba(231, 93, 13, 0.56) 166.78%)",
      }}
    >
      {/* Background Rings */}
      <div className="absolute w-[500px] h-[500px] border border-orange-500/40 rounded-full"></div>
      <div className="absolute w-[700px] h-[700px] border border-orange-500/20 rounded-full"></div>
      <div className="absolute w-[900px] h-[900px] border border-orange-500/20 rounded-full"></div>

      {/* Revolving orange arc */}
      <div className="absolute w-[900px] h-[900px] rounded-full animate-spin-slow">
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-orange-500"
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)" }}
        ></div>
      </div>
      <div className="absolute w-[700px] h-[700px] rounded-full animate-spin-slow-reverse">
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-orange-500"
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)" }}
        ></div>
      </div>

      {/* Tagline */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1A2144] rounded-full text-lg z-10">
        <Rocket className="w-4 h-4" />
        <span>Read to go viral?</span>
      </div>

      {/* Main Heading */}
      <h1 className="mt-6 text-3xl md:text-5xl font-bold z-10">
        Ready to Transform Your{" "}
        <span
         
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
          }}
        >
          Creativity
        </span>
        ?
      </h1>

      {/* Subtitle */}
      <p className="mt-4 max-w-2xl text-lg text-gray-200 z-10">
        Join thousands of creators and brands. Sign up today and unlock your
        potential!
      </p>

      {/* CTA Button */}

      <Link
        href="/auth/signup"
        className="mt-8 text-lg inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold z-10 text-white justify-center"
        style={{
            backgroundImage:
              "linear-gradient(90deg, #DD7209 0%, #FF652D 100%)",
          }}
     

      >
        <Rocket className="w-4 h-4" />
        Join Game Of Creators
        <ArrowRight className="h-5 w-5"/>
      </Link>
    </section>
  );
}
