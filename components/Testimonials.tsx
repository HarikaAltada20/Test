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

type CardPosition = {
  left?: string;
  right?: string;
  top: string;
};

const desktopCardPositions: CardPosition[] = [
  // Card 0 (Top Left)
  { left: "0%", top: "15px" },
  // Card 1 (Top Center - moved down)
  { left: "36%", top: "235px" },
  // Card 2 (Top Right)
  { right: "0%", top: "0px" },
  // Card 3 (Bottom Left)
  { left: "4%", top: "495px" },
  // Card 4 (Bottom Right)
  { right: "4%", top: "475px" },
];

function Rivets({ isLight }: { isLight: boolean }) {
  const rivet = cn(
    "pointer-events-none absolute size-2.5 rounded-full shadow-[inset_0px_0.2px_0.5px_0px_rgba(0,0,0,1.00),inset_0px_1px_2px_0px_rgba(0,0,0,1.00)]",
    isLight ? "bg-[#BDBDBD]" : "bg-[#252525]", // Replacing Foundation-Grey-grey-10 with a generic grey for dark mode
  );

  return (
    <>
      <div className="absolute left-4 top-[15px] right-4 flex justify-between pointer-events-none">
        <div className={rivet} style={{ position: 'relative' }} />
        <div className={rivet} style={{ position: 'relative' }} />
      </div>
      <div className="absolute left-4 bottom-[15px] right-4 flex justify-between pointer-events-none">
        <div className={rivet} style={{ position: 'relative' }} />
        <div className={rivet} style={{ position: 'relative' }} />
      </div>
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

      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="relative size-10 sm:size-12 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={testimonial.image}
              alt={testimonial.name}
              fill
              draggable={false}
              className="pointer-events-none object-cover"
              sizes="48px"
            />
          </div>

          <div className="flex flex-col items-start gap-[4px]">
            <h3
              className={cn(
                "text-base sm:text-lg font-medium font-['Inter'] leading-5",
                isLight ? "text-black" : "text-white",
              )}
            >
              {testimonial.name}
            </h3>
            <p
              className={cn(
                "text-sm sm:text-base font-normal font-['Inter'] leading-4",
                isLight ? "text-black/50" : "text-zinc-400",
              )}
            >
              {testimonial.role}
            </p>
          </div>
        </div>

        <p
          className={cn(
            "text-base sm:text-lg font-medium font-['Inter'] leading-6 sm:leading-7",
            isLight ? "text-black/80" : "text-white",
          )}
        >
          &ldquo;{testimonial.quote}&rdquo;
        </p>
      </div>
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
        "relative w-full max-w-[340px] rounded-3xl p-7 sm:p-9 inline-flex flex-col overflow-hidden",
        isLight
          ? "border-[#0000000D] border bg-[#ECECEC]"
          : "bg-neutral-900 shadow-[8px_8px_50px_0px_rgba(0,0,0,1.00),4px_12px_4px_0px_rgba(0,0,0,0.20),inset_0px_0px_4px_0px_rgba(255,255,255,0.25)]",
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
  position: CardPosition;
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
        right: position.right,
        top: position.top,
        zIndex,
        position: "absolute",
      }}
      className={cn(
        "w-[280px] sm:w-[310px] lg:w-80 cursor-grab touch-none select-none rounded-3xl p-6 sm:p-7 lg:p-9 active:cursor-grabbing inline-flex flex-col overflow-hidden",
        isLight
          ? "border-[#0000000D] border bg-[#ECECEC]"
          : "bg-neutral-900 shadow-[8px_8px_50px_0px_rgba(0,0,0,1.00),4px_12px_4px_0px_rgba(0,0,0,0.20),inset_0px_0px_4px_0px_rgba(255,255,255,0.25)]",
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
  const [resizeKey, setResizeKey] = useState(0);

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

  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setResizeKey((prev) => prev + 1);
      }, 100);
    };

    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (boardRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            handleResize();
          }
        }
      });
      resizeObserver.observe(boardRef.current);
    }

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  const isBrandsPage = pathname?.includes("brands") || pathname === "/brands";
  const href = isBrandsPage ? "/reviews?tab=brands" : "/reviews";

  return (
    <section
      className={cn(
        "px-4 py-14 sm:px-6 sm:py-20  transition-colors duration-300",
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
          className="relative mx-auto mt-14 hidden w-full h-[800px] max-w-[1100px] md:block"
        >
          {testimonials.map((testimonial, index) => (
            <DraggableTestimonialCard
              key={`${testimonial.name}-${resizeKey}`}
              testimonial={testimonial}
              isLight={isLight}
              constraintsRef={boardRef}
              position={desktopCardPositions[index]}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center pt-12">
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
