"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";

type Testimonial = {
  name: string;
  role: string;
  image: string;
  quote: string;
};

const creatorTestimonials: Testimonial[] = [
  {
    name: "Kabir Singh",
    role: "Creator",
    image: "/images/Ellipse 2355.avif",
    quote:
      "I've worked with brand campaigns before, but getting rewarded based on actual performance feels much more fair.",
  },
  {
    name: "Aarav Mehta",
    role: "Creator",
    image: "/images/Ellipse 2355 (1).avif",
    quote:
      "I stopped chasing followers and started getting paid for the views I actually generate.",
  },
  {
    name: "Riya Sharma",
    role: "Content Creator",
    image: "/images/Ellipse 2355 (3).avif",
    quote:
      "The campaigns are clear, the rewards are transparent, and I know exactly what I'm earning from my content.",
  },
  {
    name: "Ananya Kapoor",
    role: "Lifestyle Creator",
    image: "/images/Ellipse 2355 (2).avif",
    quote:
      "GOC makes it easy to find campaigns that actually fit the kind of content I already create.",
  },
  {
    name: "Dev Patel",
    role: "Creator",
    image: "/images/Ellipse 2355 (4).avif",
    quote:
      "My audience size isn't the only thing that matters anymore. Good content can actually earn on its performance.",
  },
];

const brandsTestimonials: Testimonial[] = [
  {
    name: "Sarah Johnson",
    role: "Marketing Director",
    image: "/images/Ellipse 2355 (3).avif",
    quote:
      "We stopped guessing which creators would perform. Now we only pay for verified results, and the campaigns are clearer for everyone.",
  },
  {
    name: "Mike Chen",
    role: "Founder, Tech Startup",
    image: "/images/Ellipse 2355 (1).avif",
    quote:
      "Game of Creators made it easy to launch performance campaigns and see exactly where our budget was going.",
  },
  {
    name: "Emma Rodriguez",
    role: "CMO",
    image: "/images/Ellipse 2355 (2).avif",
    quote:
      "The visibility into creator performance changed how we plan campaigns. Authentic content, measurable outcomes.",
  },
  {
    name: "Lisa Chen",
    role: "Head of Digital",
    image: "/images/Ellipse 2355 (7).avif",
    quote:
      "A platform that actually aligns brand goals with creator strengths — launching and tracking campaigns feels straightforward.",
  },
  {
    name: "James Carter",
    role: "Brand Manager",
    image: "/images/Ellipse 2355 (4).avif",
    quote:
      "We moved from fixed creator fees to performance-based payouts. The results speak for themselves.",
  },
];

const homeTestimonials = creatorTestimonials;

const config = {
  "/": {
    testimonials: homeTestimonials,
    heading: "See what people are saying",
  },
  "/brands": {
    testimonials: brandsTestimonials,
    heading: "See what brands are saying",
  },
  default: {
    testimonials: creatorTestimonials,
    heading: "See what creators are saying",
  },
};

const desktopCardPositions = [
  // Kabir — mid left
  { left: "0%", top: "28%" },
  // Aarav — top center
  { left: "32%", top: "0%" },
  // Riya — mid right (slightly higher than Kabir)
  { left: "64%", top: "25%" },
  // Ananya — bottom mid-left
  { left: "12%", top: "64%" },
  // Dev — bottom right
  { left: "55%", top: "58%" },
] as const;

function Rivets({ isLight }: { isLight: boolean }) {
  const rivet = cn(
    "pointer-events-none absolute h-[5px] w-[5px] rounded-full sm:h-1.5 sm:w-1.5",
    isLight ? "bg-[#BDBDBD]" : "bg-[#555555]",
  );

  return (
    <>
      <span className={cn(rivet, "left-3 top-3 sm:left-3.5 sm:top-3.5")} />
      <span className={cn(rivet, "right-3 top-3 sm:right-3.5 sm:top-3.5")} />
      <span className={cn(rivet, "bottom-3 left-3 sm:bottom-3.5 sm:left-3.5")} />
      <span
        className={cn(rivet, "bottom-3 right-3 sm:bottom-3.5 sm:right-3.5")}
      />
    </>
  );
}

function TestimonialCardContent({
  testimonial,
  isLight,
}: {
  testimonial: Testimonial;
  isLight: boolean;
}) {
  return (
    <>
      <Rivets isLight={isLight} />

      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] sm:h-12 sm:w-12">
          <Image
            src={testimonial.image}
            alt={testimonial.name}
            fill
            draggable={false}
            className="pointer-events-none object-cover"
            sizes="48px"
          />
        </div>

        <div className="min-w-0">
          <h3
            className={cn(
              "truncate text-[15px] font-semibold leading-tight sm:text-[16px]",
              isLight ? "text-black" : "text-white",
            )}
          >
            {testimonial.name}
          </h3>
          <p
            className={cn(
              "mt-0.5 text-[13px]",
              isLight ? "text-black/45" : "text-white/45",
            )}
          >
            {testimonial.role}
          </p>
        </div>
      </div>

      <p
        className={cn(
          "mt-4 text-[14px] italic leading-[1.55] sm:text-[15px]",
          isLight ? "text-black/70" : "text-white/85",
        )}
      >
        &ldquo;{testimonial.quote}&rdquo;
      </p>
    </>
  );
}

function TestimonialCard({
  testimonial,
  isLight,
  className,
}: {
  testimonial: Testimonial;
  isLight: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative w-full max-w-[340px] rounded-[16px] border px-5 pb-6 pt-5 sm:w-[340px] sm:max-w-none sm:px-6 sm:pb-7 sm:pt-6 lg:w-[360px]",
        isLight
          ? "border-[#0000000D] bg-[#ECECEC]"
          : "bg-[#171717] shadow-[8px_8px_50px_0px_#000000,4px_12px_4px_0px_#00000033,inset_0px_0px_4px_0px_#FFFFFF40]",
        className,
      )}
    >
      <TestimonialCardContent testimonial={testimonial} isLight={isLight} />
    </article>
  );
}

function DraggableTestimonialCard({
  testimonial,
  isLight,
  position,
  constraintsRef,
}: {
  testimonial: Testimonial;
  isLight: boolean;
  position: { left: string; top: string };
  constraintsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [zIndex, setZIndex] = useState(1);

  return (
    <motion.article
      drag
      dragConstraints={constraintsRef}
      dragElastic={0.12}
      dragMomentum={false}
      dragSnapToOrigin
      dragPropagation={false}
      onDragStart={() => setZIndex(50)}
      onDragEnd={() => setZIndex(10)}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      whileDrag={{
        scale: 1.03,
        cursor: "grabbing",
        boxShadow: isLight
          ? "0 24px 60px rgba(15,15,30,0.18)"
          : "0 28px 70px rgba(0,0,0,0.65)",
      }}
      style={{
        left: position.left,
        top: position.top,
        zIndex,
        position: "absolute",
      }}
      className={cn(
        "w-[340px] cursor-grab touch-none select-none rounded-[16px] border px-5 pb-6 pt-5 active:cursor-grabbing sm:px-6 sm:pb-7 sm:pt-6 lg:w-[360px]",
        isLight
          ? "border-[#0000000D] bg-[#ECECEC]"
          : "bg-[#171717] shadow-[8px_8px_50px_0px_#000000,4px_12px_4px_0px_#00000033,inset_0px_0px_4px_0px_#FFFFFF40]",
      )}
    >
      <TestimonialCardContent testimonial={testimonial} isLight={isLight} />
    </motion.article>
  );
}

export default function Testimonials() {
  const pathname = usePathname();
  const { isLight } = useThemeMode();
  const [isNavigating, setIsNavigating] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [headingAnimated, setHeadingAnimated] = useState(false);

  const key = (
    pathname in config ? pathname : "default"
  ) as keyof typeof config;
  const { testimonials, heading } = config[key];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHeadingAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    if (headingRef.current) observer.observe(headingRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const isBrandsPage = pathname?.includes("brands") || pathname === "/brands";
  const href = isBrandsPage ? "/reviews?tab=brands" : "/reviews";

  return (
    <section
      className={cn(
        "px-4 py-14 sm:px-6 sm:py-20 md:py-24 transition-colors duration-300",
        isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
      )}
    >
      <div className="mx-auto max-w-[1200px]" ref={headingRef}>
        <h2
          className={cn(
            "mx-auto max-w-[720px] text-center text-[28px] font-bold leading-[1.15] tracking-[-1px] sm:text-[36px] sm:tracking-[-1.4px] md:text-[44px] md:tracking-[-1.8px]",
            headingAnimated ? "slide-up" : "hide-before-animate",
            isLight ? "text-black" : "text-white",
          )}
          style={{ animationDelay: "0.15s" }}
        >
          {heading}
        </h2>

        {/* Mobile: stacked */}
        <div className="mt-10 flex flex-col items-center gap-5 md:hidden">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={testimonial.name}
              testimonial={testimonial}
              isLight={isLight}
            />
          ))}
        </div>

        {/* Desktop: staggered + draggable */}
        <div
          ref={boardRef}
          className="relative mx-auto mt-14 hidden h-[640px] w-full max-w-[1120px] md:block lg:h-[700px]"
        >
          {testimonials.map((testimonial, index) => (
            <DraggableTestimonialCard
              key={testimonial.name}
              testimonial={testimonial}
              isLight={isLight}
              constraintsRef={boardRef}
              position={desktopCardPositions[index]}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <Link
          href={href}
          onClick={() => setIsNavigating(true)}
          className="relative z-10 flex items-center gap-2 overflow-hidden rounded-3xl px-8 py-2.5 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
          style={{
            backgroundImage: pathname?.includes("creators")
              ? "linear-gradient(90deg, #FF512F 0%, #F09819 50%, #FF512F 100%)"
              : "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
          }}
        >
          {isNavigating ? <ButtonLoadingSpinner /> : null}
          View All Reviews
        </Link>
      </div>
    </section>
  );
}
