"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  UserRound,
  CalendarDays,
  Check,
  LineChart,
  Upload,
  UsersRound,
  Play,
  ShoppingCart,
  X,
  Wallet,
  WalletCards,
  ArrowUpRight,
  Megaphone,
  BarChart3,
} from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import CtcBanner from "@/components/CtcBanner";
import NumbersSection from "@/components/NumberSection";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
// Placeholder for social icons image - reuse from creators page
import SocialPair from "@/public/images/social_pair.avif";
import WorldMapDots from "@/public/images/image 252.png";
import BrandGetStartedButton from "@/components/BrandGetStartedButton";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { createClient } from "@/utils/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";

// const faqItemsBrands = [
//   {
//     id: "faq-brand-1",
//     question: "How do I create a contest for creators?",
//     answer:
//       "Our platform makes it easy. Simply define your campaign brief, set your prize pool, specify the type of content you're looking for (e.g., youtube videos, Instagram Reels), and launch. Creators in our network will then be able to see and participate in your contest.",
//   },
//   {
//     id: "faq-brand-2",
//     question: "How do I ensure content quality and brand alignment?",
//     answer:
//       "You provide a detailed brief outlining your brand guidelines, key messages, and content expectations. You can review submissions and provide feedback before selecting winners. Many brands also use contests to discover creators for longer-term collaborations.",
//   },
//   {
//     id: "faq-brand-3",
//     question: "What kind of results can I expect from creator contests?",
//     answer:
//       "Results vary, but brands typically receive a diverse range of authentic content pieces at a fraction of traditional production costs. This content can be used for social media, ads, and other marketing channels, often leading to increased engagement, brand awareness, and reach.",
//   },
//   {
//     id: "faq-brand-4",
//     question: "How are creators paid and how much does it cost?",
//     answer:
//       "You set the prize pool for your contest. Payments to winning creators are handled securely through our platform. Our pricing is transparent, typically involving a platform fee on top of the prize money you allocate for creators.",
//   },
// ];
const brandImages: string[] = [
  "/images/ba54cd16167abac1d45d63109c16d6999d67e552.png",
  "/images/image 277.png",
  "/images/7e659d660283b02da97f42ede238f8b03b35cb37.png",
  "/images/image 276.png",
  "/images/Frame 2147243949.png",
  "/images/0046b3171bb1d05ed8f26833e71c449ca7073d81.png",
];
interface BrandsClientProps {
  totalViews: number;
  initialTheme?: "light" | "dark";
}

const features = [
  {
    image: "/images/Frame123456.png",
    title: "Content Before It Goes Live",
    description: (
      <>
        Review and approve creator content
        <br />
        before it reaches your audience.
      </>
    ),
  },
  {
    image: "/images/Clip path group.png",
    title: "Verified, Not Self-Reported",
    description: (
      <>
        Real platform data. Verified views.
        <br />
        No inflated numbers.
      </>
    ),
  },
  {
    image: "/images/Clip path group (1).png",
    title: "One Campaign. Full Visibility.",
    description: (
      <>
        Track content, creators, spend, and
        <br />
        performance from one place.
      </>
    ),
  },
];

const comparisonItems = [
  {
    text: "Creators audience size",
    icon: UsersRound,
    status: "success",
    rotate: "-rotate-[-2.26deg]",
  },
  {
    text: "A piece of content",
    image: "/images/Frame (1).png",
    status: "success",
    rotate: "rotate-[-2.81deg]",
  },
  {
    text: "Performance",
    icon: LineChart,
    status: "error",
    rotate: "rotate-[3.87deg]",
  },
];

const submissions = [
  {
    name: "Victor Cardenas",
    subtitle: "view content",
    image: "/images/Ellipse 2355.avif",
    status: "Approved",
    approved: true,
  },
  {
    name: "Kevin Bai",
    subtitle: "Waiting...",
    image: "/images/Ellipse 2355 (1).avif",
    status: "Under Review",
    approved: false,
  },
  {
    name: "Shaan Patel",
    subtitle: "Waiting...",
    image: "/images/Ellipse 2355 (2).avif",
    status: "Under Review",
    approved: false,
  },
  {
    name: "Jimmy Deng",
    subtitle: "Waiting...",
    image: "/images/Ellipse 2355 (3).avif",
    status: "Under Review",
    approved: false,
  },
];
type Person = {
  name: string;
  x: number;
  y: number;
  /** How far the dashed connector bows upwards on its way to the campaign marker */
  arc: number;
  avatar: string;
};

// Percentage coordinates inside the map box, shared by the markers and the connectors
const campaignCenter = { x: 50, y: 45 };

const people: Person[] = [
  {
    name: "Alex",
    x: 19,
    y: 28,
    arc: 8,
    avatar: "https://i.pravatar.cc/100?img=12",
  },
  {
    name: "Leela",
    x: 66,
    y: 23,
    arc: 6,
    avatar: "https://i.pravatar.cc/100?img=47",
  },
  {
    name: "Mukesh",
    x: 66,
    y: 42,
    arc: 4,
    avatar: "https://i.pravatar.cc/100?img=11",
  },
  {
    name: "Sameer",
    x: 27,
    y: 69,
    arc: 10,
    avatar: "https://i.pravatar.cc/100?img=13",
  },
  {
    name: "Sameer",
    x: 84,
    y: 69,
    arc: 10,
    avatar: "https://i.pravatar.cc/100?img=33",
  },
];

const mapCampaignStages = [
  {
    centerLabel: "Campaign Launched",
    personLabel: (name: string) => `${name} Joined`,
  },
  {
    centerLabel: "Tracking Performance",
    personLabel: (_name: string) => "Posted Videos",
  },
  {
    centerLabel: "Money paid",
    personLabel: (_name: string) => "$400 Earned 🎉",
  },
] as const;

const MAP_STAGE_MS = 3200;

const connectionPath = ({ x, y, arc }: Person) => {
  const controlX = (x + campaignCenter.x) / 2;
  const controlY = (y + campaignCenter.y) / 2 - arc;
  return `M ${x} ${y} Q ${controlX} ${controlY} ${campaignCenter.x} ${campaignCenter.y}`;
};

interface ProfileItem {
  name: string;
  status: string;
  image: string;
  type: "good" | "bad";
}

const profiles: ProfileItem[] = [
  {
    name: "@anand",
    status: "Bot detected",
    image: "https://i.pravatar.cc/100?img=11",
    type: "bad" as const,
  },
  {
    name: "@free_giveaway",
    status: "Bot detected · Fake view",
    image: "https://i.pravatar.cc/100?img=47",
    type: "bad" as const,
  },
  {
    name: "@riya",
    status: "Verified Views",
    image: "https://i.pravatar.cc/100?img=32",
    type: "good" as const,
  },
  {
    name: "@free_giveaway",
    status: "Bot detected",
    image: "https://i.pravatar.cc/100?img=12",
    type: "bad" as const,
  },
  {
    name: "@riya",
    status: "Verified Views",
    image: "https://i.pravatar.cc/100?img=5",
    type: "good" as const,
  },
  {
    name: "@anand",
    status: "Verified Views",
    image: "https://i.pravatar.cc/100?img=33",
    type: "good" as const,
  },
];

const creators = [
  {
    name: "@sarahcreates",
    views: "125K",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
  },
  {
    name: "@rohanvlogs",
    views: "98K",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
  },
  {
    name: "@themishadity",
    views: "87K",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
  },
  {
    name: "@karanfilms",
    views: "74K",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
  },
  {
    name: "@kairos",
    views: "65K",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
  },
  {
    name: "@lumina",
    views: "58K",
    image:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=100&h=100&fit=crop",
  },
  {
    name: "@northstar",
    views: "51K",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop",
  },
];

const oldWaySteps = [
  { id: "01", title: "Pick a creator" },
  { id: "02", title: "Pay upfront" },
  { id: "03", title: "Content goes live" },
  { id: "04", title: "Wait for results" },
];

export default function BrandsClient({
  totalViews,
  initialTheme,
}: BrandsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLight } = useThemeMode(initialTheme);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fade, setFade] = useState<boolean>(true);
  const [windowWidth, setWindowWidth] = useState<number>(0);

  const sectionRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [animate, setAnimate] = useState(false);

  const animationRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const [servicesAnimated, setServicesAnimated] = useState(false);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const [howItWorksAnimated, setHowItWorksAnimated] = useState(false);
  const [isLaunchingCampaign, setIsLaunchingCampaign] = useState(false);
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInView, setMapInView] = useState(false);
  const [mapStage, setMapStage] = useState(0);
  const mapStageCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapStageCardRef.current) return;
    gsap.fromTo(
      mapStageCardRef.current,
      { opacity: 0, y: 12, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" }
    );
  }, [mapStage]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#how-it-works") {
      const timer = setTimeout(() => {
        const el = document.getElementById("how-it-works");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const oldWayRef = useRef<HTMLDivElement>(null);
  const [oldWayStep, setOldWayStep] = useState(0);
  const [comparisonTab, setComparisonTab] = useState<"old" | "goc">("old");
  const [budgetAmount, setBudgetAmount] = useState<number>(4000);
  const lastStepTimeRef = useRef<number>(0);

  const revealImgRef = useRef<HTMLImageElement | null>(null);

  // Window scroll listener driving the sticky "The Old way of promoting your brand" step animation
  useEffect(() => {
    const handleScroll = () => {
      const section = oldWayRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const scrollDistance = Math.max(
        section.offsetHeight - window.innerHeight,
        1
      );

      /*
       * Progress:
       * 0 = sticky section starts (rect.top <= 0)
       * 1 = sticky section ends (rect.top <= -scrollDistance)
       */
      const progress = Math.min(
        1,
        Math.max(0, -rect.top / scrollDistance)
      );

      const step = Math.min(
        oldWaySteps.length - 1,
        Math.floor(progress * oldWaySteps.length)
      );

      setOldWayStep(step);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const handleOldWayStepClick = (stepIndex: number) => {
    setOldWayStep(stepIndex);
    const section = oldWayRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const scrollDistance = section.offsetHeight - window.innerHeight;
    const stepProgress = (stepIndex + 0.5) / oldWaySteps.length;
    const targetScroll = sectionTop + stepProgress * scrollDistance;
    window.scrollTo({ top: targetScroll, behavior: "smooth" });
  };

  useEffect(() => {
    setIsLaunchingCampaign(false);
    setIsSigningOut(false);
  }, [pathname]);

  const handleLaunchCampaign = async () => {
    setIsLaunchingCampaign(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        const { data: userData } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", user.id)
          .single();

        if (userData?.user_type === "creator") {
          setShowCreatorModal(true);
          setIsLaunchingCampaign(false);
          return;
        }

        router.push("/dashboard/contests");
        return;
      }

      router.push("/get-started");
    } catch {
      router.push("/get-started");
    }
  };

  const handleContinueAsCreator = () => {
    setIsLaunchingCampaign(true);
    setShowCreatorModal(false);
    router.push("/dashboard/opportunities");
  };

  const handleSignOutAndContinueBrand = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
      setShowCreatorModal(false);
      router.push("/get-started");
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === animationRef.current) {
              setIsAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            if (entry.target === howItWorksRef.current) {
              setHowItWorksAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            if (entry.target === servicesRef.current) {
              setServicesAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            if (entry.target === sectionRef.current) {
              setAnimate(true);
              observerInstance.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.3 }, // Adjust if you want different triggers
    );

    if (animationRef.current) observer.observe(animationRef.current);
    if (howItWorksRef.current) observer.observe(howItWorksRef.current);
    if (servicesRef.current) observer.observe(servicesRef.current);
    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      if (animationRef.current) observer.unobserve(animationRef.current);
      if (howItWorksRef.current) observer.unobserve(howItWorksRef.current);
      if (servicesRef.current) observer.unobserve(servicesRef.current);
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry], observerInstance) => {
        if (entry.isIntersecting) {
          setMapInView(true);
          observerInstance.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapInView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = setInterval(() => {
      setMapStage((prev) => (prev + 1) % mapCampaignStages.length);
    }, MAP_STAGE_MS);

    return () => clearInterval(interval);
  }, [mapInView]);

  const activeMapStage = mapCampaignStages[mapStage];

  const servicesWeOffer = [
    {
      title: "CREATOR COLLABS",
      image: "/images/creator-collabs.avif",
      accent: "from-violet-500 to-purple-500",
    },
    {
      title: "MASS DISTRIBUTION",
      image: "/images/mass-distribution.avif",
      accent: "from-blue-500 to-cyan-400",
    },
    {
      title: "CONTENT CONSULTING",
      image: "/images/consultant.avif",
      accent: "from-emerald-500 to-lime-400",
    },
  ];

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     // Immediately change image index and set fade true
  //     setCurrentIndex((prev) => (prev + 1) % images.length);
  //     setFade(true);
  //   }, 4000);

  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "min-h-screen overflow-x-clip transition-colors duration-300",
        isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
      )}
    >
      <div className="relative z-20">
        {/* Floating Gaming Elements */}
        <main
          className={cn(
            "min-h-screen overflow-x-clip transition-colors duration-300",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
          )}
        >
          {/* Hero */}
          <section className="relative mx-auto max-w-[1080px] px-4 pt-10 text-center sm:px-6 sm:pt-14 md:pt-16">
            <div className="relative z-10">
              <h1
                className={cn(
                  "mx-auto max-w-[700px] font-['Inter'] font-bold text-3xl sm:text-4xl md:text-[52px] leading-tight sm:leading-tight md:leading-[58px] tracking-[-2%] text-center py-1",
                  isLight ? "text-black" : "bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,#FFFFFF_0%,#999999_100%)] bg-clip-text text-transparent",
                )}
              >
                Pay creators based on
                <br />
                how their content performs.
              </h1>

              <p
                className={cn(
                  "mx-auto mt-4 max-w-[680px] text-[12px] leading-6 sm:mt-5 sm:text-[14px] md:text-[20px] font-['Inter'] font-normal leading-[30px] tracking-[-0.4px] text-center",
                  isLight ? "text-black/50" : "text-[#8E8E8E]",
                )}
              >
                Set your campaign, your brief, and your budget. Game of Creators
                puts it in front of a creator network, and pays out on verified
                performance
              </p>

              <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:mt-7 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={isLaunchingCampaign}
                  className={cn(
                    "group inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto",
                    isLight
                      ? "bg-black text-white hover:bg-black/90"
                      : "border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] hover:bg-white/10",
                  )}
                >
                  {isLaunchingCampaign ? <ButtonLoadingSpinner /> : null}
                  <span>Launch a Campaign</span>
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("how-it-works")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  className={cn(
                    "group flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition sm:w-auto",
                    isLight
                      ? "border border-black/10 bg-white text-black hover:bg-white shadow-[0_8px_24px_rgba(15,15,30,0.06)]"
                      : "bg-[#DEDEDE] text-black hover:bg-white/90",
                  )}
                >
                  See How it works
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Dashboard / Analytics Card */}
          <section className="relative z-20 mx-auto mt-12 max-w-[1100px] px-4 sm:mt-16 sm:px-5 md:mt-[105px]">
            <div
              className={cn(
                "relative rounded-[20px] p-1.5 sm:rounded-[30px] sm:p-2",
                isLight
                  ? "bg-white"
                  : "bg-[#242424] shadow-[0_30px_100px_rgba(88,54,150,0.25)]",
              )}
            >
              

              {/* Main dashboard card */}
              <div
                className={cn(
                  "relative min-h-[380px] overflow-hidden rounded-[18px] sm:min-h-[500px] md:min-h-[540px] sm:rounded-[22px]",
                  isLight
                    ? "border border-black/[0.06] bg-white"
                    : "border border-white/[0.04] bg-[#151515]",
                )}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  const el = revealImgRef.current;
                  if (el) {
                    // Only trigger hover reveal spotlight on the right section
                    if (x > rect.width * 0.42) {
                      el.style.setProperty("--mx", `${x}px`);
                      el.style.setProperty("--my", `${y}px`);
                    } else {
                      el.style.setProperty("--mx", "-9999px");
                      el.style.setProperty("--my", "-9999px");
                    }
                  }
                }}
                onMouseLeave={() => {
                  const el = revealImgRef.current;
                  if (el) {
                    el.style.setProperty("--mx", "-9999px");
                    el.style.setProperty("--my", "-9999px");
                  }
                }}
              >
               
                

                {/* Dashboard image behind purple glow */}
                <div className="pointer-events-none absolute inset-0 z-[1]">
                  <Image
                    src={
                      isLight
                        ? "/images/5c1bc9327aecb9290b3284179d46d09ae2c7635c.png"
                        : "/images/photo_6199738614531428773_y.jpg"
                    }
                    alt=""
                    fill
                    className={cn(
                      "object-cover object-right-top sm:object-[45%_0%]",
                      isLight
                        ? "opacity-85 sm:opacity-95"
                        : "opacity-60 sm:opacity-75",
                    )}
                    sizes="(max-width: 1100px) 100vw, 1100px"
                    priority
                  />
                  {/* Soft fade so left copy stays 100% clean and readable */}
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-r",
                      isLight
                        ? "from-white via-white via-50% to-transparent"
                        : "from-[#151515] via-[#151515] via-50% to-transparent",
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t via-transparent",
                      isLight
                        ? "from-white to-white/20"
                        : "from-[#151515] to-[#151515]/20",
                    )}
                  />
                </div>

                {/* Interactive Reveal Image Overlay */}
                <img
                  ref={revealImgRef}
                  src={
                    isLight
                      ? "/images/5c1bc9327aecb9290b3284179d46d09ae2c7635c.png"
                      : "/images/photo_6199738614531428773_y.jpg"
                  }
                  alt="Reveal effect"
                  className="pointer-events-none absolute inset-0 z-[5] h-full w-full object-cover object-right-top sm:object-[45%_0%]"
                  style={
                    {
                      mixBlendMode: "lighten",
                      opacity: 0.7,
                      "--mx": "-9999px",
                      "--my": "-9999px",
                      WebkitMaskImage:
                        "radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 60px, rgba(255,255,255,0.6) 120px, rgba(255,255,255,0.25) 180px, rgba(255,255,255,0) 240px)",
                      maskImage:
                        "radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 60px, rgba(255,255,255,0.6) 120px, rgba(255,255,255,0.25) 180px, rgba(255,255,255,0) 240px)",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                    } as React.CSSProperties
                  }
                />

                {/* Purple glow */}
                <div className="absolute bottom-[-160px] right-[-100px] z-[1] h-[400px] w-[650px] rounded-full bg-[#8869ff]/55 blur-[100px]" />

                {/* Content */}
                <div className="relative z-10 flex min-h-[340px] flex-col justify-center px-6 py-12 sm:min-h-[440px] md:min-h-[480px] sm:px-12 sm:py-16 md:px-14">
                  <h2
                    className={cn(
                      "max-w-[510px] text-[22px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[28px] sm:tracking-[-1px] md:text-[31px]",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Don’t just run campaigns.
                    <br />
                    Know which creators perform
                  </h2>

                  <p
                    className={cn(
                      "mt-4 max-w-[390px] text-[13px] leading-6 sm:text-[14px]",
                      isLight ? "text-black/50" : "text-white/45",
                    )}
                  >
                    Know which creators, content, and moments are actually
                    driving results.
                  </p>

                  {/* <button
                    type="button"
                    onClick={handleLaunchCampaign}
                    disabled={isLaunchingCampaign}
                    className={cn(
                      "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit",
                      isLight
                        ? "bg-black text-white hover:bg-black/90"
                        : "bg-white text-black hover:bg-white/90",
                    )}
                  >
                    {isLaunchingCampaign ? <ButtonLoadingSpinner /> : null}
                    <span>Launch a Campaign</span>
                    <ArrowRight size={14} />
                  </button> */}
                </div>
              </div>

              {/* Feature cards */}
              <div
                className={cn(
                  "mt-3 grid grid-cols-1 gap-6 rounded-[18px] p-5 sm:gap-6 sm:rounded-[22px] sm:p-7 md:grid-cols-3",
                  isLight ? "bg-[#f7f7f7]" : "bg-[#151515]",
                )}
              >
                {features.map((feature) => (
                  <div key={feature.title}>
                    <div
                      className={cn(
                       "mb-4 flex h-[35px] w-[35px] items-center justify-center rounded-full",
                        isLight
                          ? "bg-black/5 text-black/70"
                          : "bg-[#535353] shadow-[0px_0.5px_1px_0px_var(--FoundationGreygrey-7)] text-white/80",
                      )}
                    >
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="h-[20px] w-[20px] object-contain"
                      />
                    </div>

                    <h3
                      className={cn(
                        "text-[18px] font-semibold leading-snug",
                        isLight ? "text-black" : "text-white/90",
                      )}
                    >
                      {feature.title}
                    </h3>

                    <p className="mt-2 text-[15px] leading-relaxed text-[#757575]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* Infinite Scroll Images Section */}
        <section
  className={cn(
    "min-h-[300px] overflow-hidden pt-16 pb-8 transition-colors duration-300",
    isLight ? "bg-[#F1F1F1]" : "bg-black",
  )}
>
          <p
            className={cn(
              "mb-6 px-4 text-center text-[14px] sm:mb-8 sm:text-base",
              isLight ? "text-black/45" : "text-zinc-500",
            )}
          >
           Trusted by
          </p>
          <div className="relative mx-auto w-full max-w-[1100px] overflow-hidden">
            {/* Logos scroll sideways only inside this clipped band */}
            <div
              className="flex w-max animate-scroll-left items-center gap-10 py-3 sm:gap-14 md:gap-16"
              // style={{
              //   WebkitMaskImage:
              //     "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
              //   maskImage:
              //     "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
              // }}
            >
              {[...brandImages, ...brandImages].map((image, index) => {
                const isCircle = image.includes("image 276");
                return (
                  <div
                    key={`${image}-${index}`}
                    className={cn(
                      "flex shrink-0 items-center justify-center",
                      isCircle
                        ? "h-12 w-12 sm:h-14 sm:w-14"
                        : "h-10 w-[120px] sm:h-12 sm:w-[150px] md:h-14 md:w-[180px]",
                    )}
                  >
                    <Image
                      src={image}
                      alt={`Brand logo ${index + 1}`}
                      width={isCircle ? 50 : 180}
                      height={isCircle ? 56 : 56}
                      className={cn(
                        "h-full w-full object-contain",
                        isCircle && "rounded-full",
                        isLight && !isCircle && "brightness-0",
                      )}
                    />
                  </div>
                );
              })}
            </div>

            {/* Black blur edges */}
            {/* <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 z-10 w-28 sm:w-40 md:w-52",
                isLight
                  ? "bg-gradient-to-r from-[#F1F1F1] via-[#F1F1F1]/70 to-transparent"
                  : "bg-gradient-to-r from-black via-black/70 to-transparent backdrop-blur-[2px]",
              )}
            /> */}
            {/* <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 z-10 w-28 sm:w-40 md:w-52",
                isLight
                  ? "bg-gradient-to-l from-[#F1F1F1] via-[#F1F1F1]/70 to-transparent"
                  : "bg-gradient-to-l from-black via-black/70 to-transparent backdrop-blur-[2px]",
              )}
            /> */}
          </div>
        </section>
        {/* Old way vs With GOC Comparison Section */}
        <section
          id="old-way"
          ref={oldWayRef}
          className={cn(
            "relative w-full py-16 sm:py-20 md:py-24 px-4 sm:px-6 transition-colors duration-300 overflow-hidden",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white"
          )}
        >
          <div className="relative mx-auto max-w-[1280px] flex flex-col items-center gap-8 sm:gap-12">
            {/* Toggle Pills */}
            <div className="relative flex h-[49px] w-full max-w-[398px] items-center rounded-full bg-[#242424] p-1 shadow-lg border border-white/5">
              <motion.div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-[#353535] shadow-[-0.73px_2.56px_4.39px_0.37px_rgba(0,0,0,0.40)]"
                initial={false}
                animate={{
                  left: comparisonTab === "old" ? "4px" : "calc(50% + 0px)",
                }}
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
              <button
                type="button"
                onClick={() => setComparisonTab("old")}
                className={cn(
                  "relative z-10 flex flex-1 items-center justify-center rounded-full text-[15.36px] font-semibold transition-colors duration-200 py-2 select-none",
                  comparisonTab === "old" ? "text-[#F1F1F1]" : "text-[#C4C4C4] hover:text-white"
                )}
              >
                Old way
              </button>
              <button
                type="button"
                onClick={() => setComparisonTab("goc")}
                className={cn(
                  "relative z-10 flex flex-1 items-center justify-center rounded-full text-[15.36px] font-semibold transition-colors duration-200 py-2 select-none",
                  comparisonTab === "goc" ? "text-[#F1F1F1]" : "text-[#C4C4C4] hover:text-white"
                )}
              >
                With GOC
              </button>
            </div>

            {/* CARDS CONTAINER */}
            <div className="flex w-full flex-col items-center justify-center px-0 sm:px-2">
              {/* CAMPAIGN BUDGET & RISK CARD */}
              <div className="relative flex h-auto w-full max-w-[520px] shrink-0 flex-col gap-2 rounded-[22px] sm:rounded-[26px] bg-[#171719] p-5 xs:p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div>
                  {/* Top row: Gold coins graphic + Budget */}
                  <div className="flex items-center justify-between mb-5">
                    {/* Gold Coins Stack Image */}
                    <img
                      src="/images/Icon area.png"
                      alt="Campaign Budget Coins"
                      className="h-10 w-11 sm:h-12 sm:w-14 object-contain select-none pointer-events-none"
                    />

                    <div className="text-right">
                      <p className="text-[12px] sm:text-[14px] font-medium text-[#8E8E8E] leading-4">Campaign budget</p>
                      <p className="text-3xl sm:text-4xl md:text-[46px] font-bold text-[#F1F1F1] leading-tight sm:leading-[50px] mt-1">
                        ${budgetAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Interactive Budget Progress Bar Slider */}
                  {(() => {
                    const min = comparisonTab === "old" ? 1000 : 500;
                    const max = 10000;
                    const pct = Math.min(100, Math.max(0, ((budgetAmount - min) / (max - min)) * 100));
                    return (
                      <div className="my-5">
                        <div className="relative h-[34px] sm:h-[38px] w-full rounded-[100px] bg-[#353535] p-1 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-[16777240px] transition-all duration-150 shadow-[inset_0_1px_5px_rgba(255,255,255,0.25)]",
                              comparisonTab === "old"
                                ? "bg-gradient-to-r from-[#F45D48] to-[#942E20]"
                                : "bg-[#8B5CF6]"
                            )}
                            style={{ width: `${Math.max(10, pct)}%` }}
                          />
                          <div
                            className="absolute top-[4px] sm:top-[4px] h-[26px] w-[26px] sm:h-[30px] sm:w-[30px] rounded-full bg-[#F1F1F1] shadow-[0_1px_3px_rgba(0,0,0,0.20)] transition-all duration-150 pointer-events-none"
                            style={{
                              left: `calc(${pct}% - ${(pct / 100) * 24}px - 6px)`,
                            }}
                          />
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={500}
                            value={budgetAmount}
                            onChange={(e) => setBudgetAmount(Number(e.target.value))}
                            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer z-20"
                          />
                        </div>
                        {/* Scale values */}
                        <div className="mt-2.5 flex items-center justify-between text-[10px] sm:text-[12px] font-semibold text-[#8E8E8E]">
                          {comparisonTab === "old" ? (
                            <>
                              <span>$1k</span>
                              <span>$3k</span>
                              <span>$5k</span>
                              <span>$7k</span>
                              <span>$10k</span>
                            </>
                          ) : (
                            <>
                              <span>$500</span>
                              <span>$2k</span>
                              <span>$5k</span>
                              <span>$7k</span>
                              <span>$10k</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Two Stat Boxes */}
                  <div className="my-5 grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex flex-col justify-start rounded-[14px] bg-[#252525] p-3.5 sm:p-4.5">
                      <p className="text-[12px] sm:text-[14px] font-medium text-[#8E8E8E] leading-tight">
                        {comparisonTab === "old" ? "Fixed fee at risk" : "Milestone"}
                      </p>
                      <p
                        className={cn(
                          "mt-1.5 text-lg sm:text-xl md:text-2xl font-bold leading-tight transition-colors duration-300",
                          comparisonTab === "old" ? "text-[#FF4938]" : "text-white"
                        )}
                      >
                        {comparisonTab === "old" ? (
                          `$${budgetAmount.toLocaleString()}`
                        ) : (
                          <span className="flex items-baseline gap-1">
                            <span className="text-[#8B5CF6]">${Math.round(budgetAmount / 100)}</span>
                            <span className="text-xs sm:text-sm font-medium text-[#8E8E8E]">/{Math.round(budgetAmount / 100)}K views</span>
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col justify-start rounded-[14px] bg-[#252525] p-3.5 sm:p-4.5">
                      <p className="text-[12px] sm:text-[14px] font-medium text-[#8E8E8E] leading-tight">
                        {comparisonTab === "old" ? "Guaranteed views" : "Est. verified views"}
                      </p>
                      <p
                        className={cn(
                          "mt-1.5 text-lg sm:text-xl md:text-2xl font-bold leading-tight transition-colors duration-300",
                          comparisonTab === "old" ? "text-[#F1F1F1]" : "text-[#22C55E]"
                        )}
                      >
                        {comparisonTab === "old"
                          ? "0"
                          : budgetAmount * 598 >= 1000000
                          ? `${((budgetAmount * 598) / 1000000).toFixed(1)}M`
                          : `${Math.round((budgetAmount * 598) / 1000)}K`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Note */}
                <p className="text-center text-[11px] sm:text-[12px] font-medium text-[#757575] mt-1">
                  • Illustrative example
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Services We Offer */}
        {/* <section className="py-16 md:py-20" ref={servicesRef}>
          <div className="max-w-[1200px] mx-auto px-4 md:px-12 xl:px-4 text-center">
      
            <h2
              className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${
                servicesAnimated ? "slide-up" : "hide-before-animate"
              }`}
            >
              <span className="text-white">The </span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Services
              </span>
              <span className="text-white"> We Offer</span>
            </h2>
            <p
              className={`text-slate-300 text-base sm:text-lg md:text-xl mb-10 ${
                servicesAnimated ? "slide-left" : "hide-before-animate"
              }`}
            >
              The tools to make your brand go viral.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {servicesWeOffer.map((service) => (
                <Link key={service.title} href="/get-started" className="block">
                  <article className="group relative rounded-[28px] border border-slate-700/80 bg-[#0B1234] p-4 sm:p-5 text-left overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-slate-500">
                    <div className="relative h-56 sm:h-64 md:h-72 w-full overflow-hidden rounded-2xl border border-slate-600/70">
                      <Image
                        src={service.image}
                        alt={service.title}
                        fill
                        className="h-full w-full object-cover bg-[#0A102D] p-4 transition-transform duration-500 group-hover:scale-105"
                        sizes="(min-width: 768px) 33vw, 100vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#00000099] via-transparent to-transparent" />
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-4">
                      <h3 className="text-xl sm:text-2xl font-extrabold leading-[1.05] tracking-tight text-white max-w-[12ch]">
                        {service.title}
                      </h3>

                      <span
                        className={`shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r ${service.accent} text-black transition-transform duration-300 group-hover:rotate-12`}
                      >
                        <ArrowUpRight size={20} strokeWidth={2.5} />
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section> */}

        {/* Campaign Process Cards */}
        <section
          id="how-it-works"
          ref={howItWorksRef}
          className={cn(
            "relative py-14 sm:py-20 md:py-28 transition-colors duration-300 scroll-mt-20",
            isLight ? "bg-[#F1F1F1]" : "bg-[#030405]",
          )}
        >
          {isLight ? (
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[55%] h-[420px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(186,155,255,0.18)_0%,rgba(196,181,253,0.08)_40%,transparent_72%)]"
            />
          ) : null}
          <div className="relative mx-auto max-w-[1200px] px-4 sm:px-5">
            {/* Heading */}
            <div className="mb-10 text-center sm:mb-16">
              <h2
                className={cn(
                  "text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-[52px]",
                  isLight ? "text-black" : "text-white",
                )}
              >
                The New way with
                <br />
                just three simple steps
              </h2>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 min-[700px]:grid-cols-2 min-[900px]:grid-cols-3">
              {/* Card 1 */}
              <div
                className={cn(
                  "relative min-h-[460px] overflow-hidden rounded-[20px] sm:min-h-[515px]",
                  isLight
                    ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                    : "border border-[#FFFFFF1A] bg-[#171717] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]",
                )}
              >
                {/* =========================
    BACKGROUND DETAILS FORM
=========================                {/* =========================
    BACKGROUND DETAILS FORM (MASK GROUP)
========================== */}
                <div
                  className="absolute left-3 right-3 top-3 h-[240px] overflow-hidden sm:left-5 sm:right-5 sm:top-12 sm:h-[240px]"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse 75% 75% at 60% 40%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
                    maskImage:
                      "radial-gradient(ellipse 75% 75% at 60% 40%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
                  }}
                >
                  <div className="relative flex h-full w-full justify-center pt-2">
                    {/* Details Card Frame */}
                    <div
                      data-layer="Frame"
                      className={cn(
                        "Frame flex h-[200px] w-[280px] sm:h-[244.83px] sm:w-[365.41px] flex-col justify-start gap-[9.72px] rounded-[9.72px] p-[11.66px] transition-colors duration-300",
                        isLight
                          ? "bg-white border border-[#A890F9]/40 shadow-sm text-black"
                          : "bg-[#131313] outline-[0.49px] outline-[#A890F9] outline-offset-[-0.49px] text-white",
                      )}
                    >
                      {/* Section Header */}
                      <div className="flex items-center justify-between pb-[5.83px]">
                        <div className="flex items-center gap-[5.83px]">
                          <div
                            className={cn(
                              "flex h-[13.6px] w-[13.6px] items-center justify-center rounded-[5.83px]",
                              isLight ? "bg-[#7C3AED]/15 text-[#7C3AED]" : "bg-[#2E2E2E] text-white",
                            )}
                          >
                            <span className="text-[5.83px] font-medium">1</span>
                          </div>
                          <span
                            className={cn(
                              "text-[9.51px] font-medium",
                              isLight ? "text-black" : "text-white",
                            )}
                          >
                            Details
                          </span>
                        </div>
                      </div>

                      {/* Campaign Title Field */}
                      <div className="flex flex-col gap-[3.89px]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-[1.94px]">
                            <span className={cn("text-[6.32px] font-medium", isLight ? "text-black/80" : "text-[#F1EEF5]")}>
                              Campaign title
                            </span>
                            <span className="text-[6.32px] font-medium text-[#EF4444]">*</span>
                          </div>
                          <span className={cn("text-[5.83px] font-normal", isLight ? "text-black/50" : "text-[#9E9AA6]")}>
                            0/100
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex items-center rounded-[3.89px] px-[7.77px] py-[5.83px]",
                            isLight
                              ? "bg-black/[0.04] border border-black/10 text-black/60"
                              : "bg-[#222222] outline-[0.49px] outline-[#353535] outline-offset-[-0.49px] text-[#9E9AA6]",
                          )}
                        >
                          <span className="text-[6.8px] font-normal">
                            e.g., Create a Viral shorts/video for our New App
                          </span>
                        </div>
                      </div>

                      {/* Platform + Content Type Row */}
                      <div className="flex gap-[7.77px]">
                        {/* Platform */}
                        <div className="flex flex-1 flex-col gap-[3.89px]">
                          <div className="flex items-start gap-[1.94px]">
                            <span className={cn("text-[6.32px] font-medium", isLight ? "text-black/80" : "text-[#F1EEF5]")}>
                              Platform
                            </span>
                            <span className="text-[6.32px] font-medium text-[#EF4444]">*</span>
                          </div>
                          <div
                            className={cn(
                              "flex items-center justify-between rounded-[3.89px] px-[7.77px] py-[5.83px]",
                              isLight
                                ? "bg-black/[0.04] border border-black/10 text-black"
                                : "bg-[#222222] outline-[0.49px] outline-[#353535] outline-offset-[-0.49px] text-[#F1EEF5]",
                            )}
                          >
                            <div className="flex items-center gap-[3.89px]">
                              <div className="flex h-[8px] w-[11px] items-center justify-center rounded-[2.5px] bg-[#737373]">
                                <span className="text-[4px] leading-none text-white">▶</span>
                              </div>
                              <span className={cn("text-[6.8px] font-normal", isLight ? "text-black/60" : "text-[#9E9AA6]")}>YouTube</span>
                            </div>
                            <span className="text-[6px] opacity-60">▼</span>
                          </div>
                        </div>

                        {/* Content Type (optional) */}
                        <div className="flex flex-1 flex-col gap-[3.89px]">
                          <div className="flex items-start gap-[1.94px]">
                            <span className={cn("text-[6.32px] font-medium", isLight ? "text-black/80" : "text-[#F1EEF5]")}>
                              Content Type (optional)
                            </span>
                          </div>
                          <div
                            className={cn(
                              "flex items-center justify-between rounded-[3.89px] px-[7.77px] py-[5.83px]",
                              isLight
                                ? "bg-black/[0.04] border border-black/10 text-black/60"
                                : "bg-[#222222] outline-[0.49px] outline-[#252332] outline-offset-[-0.49px] text-[#F1EEF5]",
                            )}
                          >
                            <span className="text-[6.8px] font-normal">Select content type</span>
                            <span className="text-[6px] opacity-60">▼</span>
                          </div>
                        </div>
                      </div>

                      {/* Thumbnail Field */}
                      <div className="flex flex-col gap-[3.89px]">
                        <span className={cn("text-[6.32px] font-medium", isLight ? "text-black/80" : "text-[#F1EEF5]")}>
                          Thumbnail
                        </span>
                        <div
                          className={cn(
                            "flex flex-col items-center justify-center rounded-[3.89px] p-[9.72px]",
                            isLight
                              ? "bg-black/[0.04] border border-dashed border-black/15 text-black/60"
                              : "bg-[#222222] outline-[0.49px] outline-[#353535] outline-offset-[-0.49px]",
                          )}
                        >
                          <div className="flex flex-col items-center gap-[3.89px]">
                            <Upload size={11.66} className={isLight ? "text-black/60" : "text-[#737373]"} />
                            <p className="text-[6.8px] font-normal">
                              <span className={isLight ? "text-black/70" : "text-[#F1EEF5]"}>Drag, drop or </span>
                              <span className={cn("underline", isLight ? "text-[#7C3AED]" : "text-[#F1EEF5]")}>
                                browse thumbnail
                              </span>
                            </p>
                            <span className={cn("text-[5.83px] font-normal", isLight ? "text-black/50" : "text-[#9E9AA6]")}>
                              Max file size: 5MB
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Soft edge shade overlays — fades content smoothly on all 4 sides */}
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-y-0 left-0 w-10",
                      isLight
                        ? "bg-gradient-to-r from-[#ECECEC] via-[#ECECEC]/70 to-transparent"
                        : "bg-gradient-to-r from-[#171717] via-[#171717]/70 to-transparent",
                    )}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-y-0 right-0 w-10",
                      isLight
                        ? "bg-gradient-to-l from-[#ECECEC] via-[#ECECEC]/70 to-transparent"
                        : "bg-gradient-to-l from-[#171717] via-[#171717]/70 to-transparent",
                    )}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 h-8",
                      isLight
                        ? "bg-gradient-to-b from-[#ECECEC] via-[#ECECEC]/60 to-transparent"
                        : "bg-gradient-to-b from-[#171717] via-[#171717]/60 to-transparent",
                    )}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 h-[35%]",
                      isLight
                        ? "bg-gradient-to-t from-[#ECECEC] via-[#ECECEC]/85 to-transparent"
                        : "bg-gradient-to-t from-[#171717] via-[#171717]/85 to-transparent",
                    )}
                  />
                </div>

                {/* =========================
    SHADE / OVERLAY
========================== */}
                {isLight ? (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#ECECEC]/35 via-[#ECECEC]/55 to-[#ECECEC]" />
                    <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/60 blur-[50px]" />
                    <div className="pointer-events-none absolute left-1/2 top-[40%] h-24 w-[90%] -translate-x-1/2 rounded-full bg-white/50 blur-[40px]" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-black/35" />
                    <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-black/30 via-black/20 to-transparent" />
                    <div className="pointer-events-none absolute -left-16 -top-16 h-60 w-60 rounded-full bg-[#D9D9D9]/25 blur-[90px]" />
                  </>
                )}

                {/* =========================
    BUDGET CARD (Figma Spec)
========================== */}
                <div
                  className={cn(
                    "absolute right-6 top-6 z-10 transition-colors duration-300",
                    isLight ? "opacity-100" : "opacity-[0.85]",
                  )}
                >
                  {/* Purple glow behind card */}
                  <div
                    className={cn(
                      "absolute -inset-[2px] rounded-[14px] blur-md",
                      isLight
                        ? "bg-[radial-gradient(circle,rgba(124,58,237,0.18),transparent_70%)]"
                        : "bg-[radial-gradient(circle,rgba(200,145,255,0.25),transparent_75%)]",
                    )}
                  />

                  {/* Outer Budget Container */}
                  <div
                    className={cn(
                      "relative flex flex-col justify-start gap-[6px] rounded-[12px] p-[8px] overflow-hidden transition-all duration-300",
                      isLight
                        ? "bg-white border border-[#A890F9]/30 shadow-md text-black"
                        : "bg-[#131313] outline-[0.60px] outline-[#C891FF] outline-offset-[-0.60px] text-white",
                    )}
                  >
                    {/* Header Row: Wallet Icon + Budget Title */}
                    <div className="flex items-center gap-[6px]">
                      <Wallet
                        size={14}
                        className={isLight ? "text-black/70" : "text-white"}
                      />
                      <span
                        className={cn(
                          "text-[12px] font-medium leading-[14.40px]",
                          isLight ? "text-black/80" : "text-white",
                        )}
                      >
                        Budget
                      </span>
                    </div>

                    {/* Value Field */}
                    <div
                      className={cn(
                        "flex items-center justify-start rounded-[5.72px] px-[12px] py-[4px] w-[150px]",
                        isLight
                          ? "bg-black/[0.04] border border-black/10 text-black/70"
                          : "bg-[#222222] outline-[0.72px] outline-[#353535] outline-offset-[-0.72px] text-[#757575]",
                      )}
                    >
                      <span
                        className={cn(
                          "text-[12px] font-medium",
                          isLight ? "text-black/80" : "text-[#757575]",
                        )}
                      >
                        $ 24000
                      </span>
                    </div>
                  </div>
                </div>

                {/* =========================
    BOTTOM GRADIENT
========================== */}

                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t to-transparent",
                    isLight
                      ? "from-[#ECECEC] via-[#ECECEC]/95"
                      : "from-[#191919] via-[#191919]/95",
                  )}
                />

                {/* =========================
    TABS
========================== */}

                <div className="absolute left-3 right-3 top-[255px] z-20 flex justify-center sm:left-4 sm:right-4 min-[1150px]:left-7 min-[1150px]:right-auto min-[1150px]:justify-start sm:top-[295px]">
                  <div
                    className={cn(
                      "flex w-full max-w-[440px] items-center justify-between min-[1150px]:w-max min-[1150px]:max-w-none rounded-full p-0.5 sm:p-1 min-[1150px]:p-1.5 backdrop-blur-lg gap-0.5 min-[1150px]:gap-2",
                      isLight
                        ? "border border-black/[0.06] bg-white shadow-[0_10px_30px_rgba(20,16,40,0.12)]"
                        : "border border-white/10 bg-[#2a2a2a]/90",
                    )}
                  >
                    <button className="flex-1 min-[1150px]:flex-initial rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-1.5 py-1 min-[360px]:px-2 min-[360px]:py-1 min-[1150px]:px-4 min-[1150px]:py-1.5 text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-sm text-white shadow-[0_4px_18px_rgba(124,58,237,0.55)] shrink-0 font-medium text-center whitespace-nowrap">
                      CPM
                    </button>

                    <button
                      className={cn(
                        "flex-1 min-[1150px]:flex-initial text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-[12px] text-center whitespace-nowrap px-1 py-1 min-[360px]:px-1.5 min-[360px]:py-1 min-[1150px]:px-1.2 min-[1150px]:py-1.5 font-medium shrink-0",
                        isLight ? "text-black/55" : "text-gray-400",
                      )}
                    >
                      Leaderboard
                    </button>

                    <button
                      className={cn(
                        "flex-1 min-[1150px]:flex-initial text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-[12px] text-center whitespace-nowrap px-1 py-1 min-[360px]:px-1.5 min-[360px]:py-1 min-[1150px]:px-1.2 min-[1150px]:py-1.5 font-medium shrink-0",
                        isLight ? "text-black/55" : "text-gray-400",
                      )}
                    >
                      Milestone
                    </button>

                    <button
                      className={cn(
                        "flex-1 min-[1150px]:flex-initial text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-[12px] text-center whitespace-nowrap px-1 py-1 min-[360px]:px-1.5 min-[360px]:py-1 min-[1150px]:px-1.2 min-[1150px]:py-1.5 font-medium shrink-0",
                        isLight ? "text-black/55" : "text-gray-400",
                      )}
                    >
                      Dual Rewards
                    </button>
                  </div>
                </div>

                {/* =========================
    CONTENT
========================== */}

                <div className="absolute bottom-10 left-7 right-7 z-20">
                  <h2
                    className={cn(
                      "mb-3 text-2xl font-semibold",
                      isLight ? "text-black" : "text-[#d6d6d6]",
                    )}
                  >
                    Set up your campaign
                  </h2>

                  <p
                    className={cn(
                      "text-md leading-[1.45]",
                      isLight ? "text-black/50" : "text-[#a8a8a8]",
                    )}
                  >
                    Define your brief, content requirements, rules, platforms
                    and budget to tailor your campaign strategy.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div
                className={cn(
                  "relative min-h-[515px] overflow-hidden rounded-[20px]",
                  isLight
                    ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                    : "border border-[#FFFFFF1A] bg-[#171717] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]",
                )}
              >
                {/* Campaign thumbnails sitting behind the reel — keep in both modes */}
                <div className="absolute inset-0 scale-110 blur-[2px]">
                  <div className="relative h-1/2 w-full">
                    <Image
                      src="/images/1ad1c9f574ea6d160a89ed07d1b57719736a1741.png"
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="relative h-1/2 w-full">
                    <Image
                      src="/images/fa2936792bd0f4aac9c0930fabbd4e09bf1395f3.png"
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>

                <div
                  className={cn(
                    "absolute inset-0",
                    isLight ? "bg-[#ECECEC]/70" : "bg-[#232020]/95",
                  )}
                />

                {/* Soft haze behind center image */}
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-6 bottom-32 top-10 rounded-[48px] blur-[55px]",
                    isLight ? "bg-white/40" : "bg-white/[0.12]",
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute -left-6 top-20 h-52 w-32 rounded-full blur-[55px]",
                    isLight ? "bg-white/50" : "bg-white/20",
                  )}
                />

                {/* Center creator image */}
                <div className="absolute inset-x-0 bottom-0 top-2">
                  <Image
                    src={
                      isLight
                        ? "/images/5ea833a17e931da84955c160c3b7bcff595137d2.png"
                        : "/images/Mask group (1).png"
                    }
                    alt="Creator publishing a reel"
                    fill
                    className="object-contain object-top"
                  />
                  {/* Bottom shade on image */}
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 h-[45%]",
                      isLight
                        ? "bg-gradient-to-t from-[#ECECEC] via-[#ECECEC]/85 to-transparent"
                        : "bg-gradient-to-t from-[#1b1b1b] via-[#1b1b1b]/70 to-transparent",
                    )}
                  />
                </div>

                {/* Overlay */}
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-b",
                    isLight
                      ? "from-transparent via-transparent to-[#ECECEC]"
                      : "from-black/20 via-black/30 to-[#1b1b1b]",
                  )}
                />

                {/* Publish badge */}
                <div className="absolute right-9 top-7 z-10">
                  <div className="relative inline-flex items-center">
                    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-4 py-2 text-sm font-medium text-white shadow-lg">
                      Publish
                    </span>
                    <div className="pointer-events-none absolute -bottom-3.5 -left-3.5 h-7 w-7">
                      <Image
                        src="/images/Icon.png"
                        alt="Click icon"
                        width={28}
                        height={28}
                        className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="absolute bottom-8 left-7 right-7 z-10">
                  <h3
                    className={cn(
                      "mb-3 text-2xl font-semibold",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Creators discover & publish
                  </h3>

                  <p
                    className={cn(
                      "text-base leading-6",
                      isLight ? "text-black/50" : "text-gray-400",
                    )}
                  >
                    {isLight
                      ? "Your campaign goes live to a network of creators. They create and publish content under your brief."
                      : "Creators create content based on your brief, gets reviewed and goes live after your approval"}
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div
                className={cn(
                  "relative min-h-[515px] overflow-hidden rounded-[20px] min-[700px]:col-span-2 min-[900px]:col-span-1",
                  isLight
                    ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                    : "border border-[#FFFFFF1A] bg-[#171717] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]",
                )}
              >
                {/* Top background image */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[350px] ">
                  <Image
                    src="/images/image 239 (1).png"
                    alt="Background graphic"
                    fill
                    className="object-contain object-top"
                  />
                </div>

                {/* Rewards panel */}
                <div
                  className={cn(
                    "absolute left-4 right-4 top-8 sm:left-6 sm:right-6 min-[900px]:left-4 min-[900px]:-right-3 min-[1100px]:left-6 min-[1100px]:-right-4 sm:top-16 rounded-2xl p-4 sm:p-5 transition-all duration-300",
                    isLight
                      ? "border border-black/[0.06] bg-[#DEDEDE] shadow-[0px_11px_21.99px_0px_#FFFFFF5C]"
                      : "border border-[#353535] bg-[#1F1F1F]",
                  )}
                  style={{
                    WebkitMaskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)",
                    maskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)",
                  }}
                >
                  <h4
                    className={cn(
                      "mb-5 text-base font-semibold",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Rewards Paid
                  </h4>

                  {[
                    {
                      name: "@glow.with.me",
                      category: "Fashion & Lifestyle",
                      amount: "$420",
                      avatar: "/images/Ellipse 2355.avif",
                    },
                    {
                      name: "@editing.daily",
                      category: "Skincare",
                      amount: "$310",
                      avatar: "/images/Ellipse 2355 (1).avif",
                    },
                    {
                      name: "@thatgirl.routines",
                      category: "Beauty",
                      amount: "$950",
                      avatar: "/images/Ellipse 2355 (2).avif",
                    },
                  ].map((user) => (
                    <div
                      key={user.name}
                      className={cn(
                        "flex items-center justify-between py-3 last:border-0",
                        isLight
                          ? "border-b border-black/[0.06]"
                          : "border-b border-white/5",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-8 w-8 overflow-hidden rounded-full">
                          <Image
                            src={user.avatar}
                            alt={user.name}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>

                        <div>
                          <p
                            className={cn(
                              "text-xs",
                              isLight ? "text-black/80" : "text-gray-300",
                            )}
                          >
                            {user.name}
                          </p>
                          <p
                            className={cn(
                              "text-[9px]",
                              isLight ? "text-black/40" : "text-gray-500",
                            )}
                          >
                            {user.category}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-sm",
                            isLight ? "text-black/80" : "text-gray-300",
                          )}
                        >
                          {user.amount}
                        </span>

                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-[9px]",
                            isLight
                              ? "bg-[#E8F8F1] text-[#1EAA7D]"
                              : "bg-green-500/10 text-green-400",
                          )}
                        >
                          ✓ Paid
                        </span>
                      </div>
                    </div>
                  ))}

                  <p
                    className={cn(
                      "mt-5 flex items-center justify-center gap-1.5 text-center text-[9px] font-medium",
                      isLight ? "text-black/60" : "text-gray-300",
                    )}
                  >
                    <BarChart3 size={11} className="opacity-80" />
                    All payments are based on verified performance
                  </p>
                </div>

                {/* Bottom fade for light mode text area */}
                {isLight ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#ECECEC] via-[#ECECEC] to-transparent" />
                ) : null}

                {/* Content */}
                <div className="absolute bottom-8 left-7 right-7 z-10">
                  <h3
                    className={cn(
                      "mb-3 text-2xl font-semibold",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    {isLight
                      ? "Performance is verified & rewards are paid"
                      : "Verified results. Rewards paid."}
                  </h3>

                  <p
                    className={cn(
                      "text-base leading-6",
                      isLight ? "text-black/50" : "text-gray-400",
                    )}
                  >
                    We track performance so creators get paid on results and you
                    see where your budget went.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "relative overflow-hidden px-4 py-16 sm:py-20 md:py-24 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1]" : "bg-[#030307]",
          )}
        >
          {/* Purple background glow — dark mode only */}
          {!isLight ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 opacity-70 mix-blend-screen">
              <Image
                src="/images/eda9d4af3a5188c592e888012bb7b9e177b3c04d.png"
                alt=""
                fill
                className="scale-y-[-1] object-fill"
              />
            </div>
          ) : null}

          {/* Annotation */}
          <div className="relative z-10 mx-auto mb-10 flex max-w-[900px] justify-center px-2 sm:mb-16 sm:justify-end sm:px-6 md:mb-24">
            <div className="relative mr-0 text-center sm:mr-4 sm:text-left">
              <p
                className={cn(
                  "font-[cursive] text-lg italic sm:text-xl md:text-2xl",
                  isLight ? "text-[#535353]" : "text-white/75",
                )}
              >
                Get full control to approve a reel before making live
              </p>

              {/* Curved arrow */}
              <svg
                className={cn(
                  "absolute -bottom-16 left-1/2 hidden h-20 w-20 -translate-x-1/2 sm:-bottom-20 sm:left-24 sm:block sm:h-24 sm:w-24 sm:translate-x-0",
                  isLight ? "text-black/35" : "text-white/70",
                )}
                viewBox="0 0 100 100"
                fill="none"
              >
                <path
                  d="M15 80 C30 45, 65 40, 55 15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M51 18 L55 12 L58 20"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="54"
                  cy="50"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>

          {/* Main glass container — outer shell for half-merged card */}
          <div
            className={cn(
              "relative z-10 mx-auto flex min-h-[380px] w-full max-w-[730px] items-start justify-center overflow-hidden rounded-[16px] px-3 pt-5 pb-6 sm:h-[400px] sm:min-h-0 sm:pb-0 sm:w-[90%] sm:rounded-[18px] sm:px-4 sm:pt-10 md:h-[430px] md:pt-12",
              isLight
                ? "border border-[#0000001A] bg-white"
                : "border border-white/15 bg-[#121212] shadow-[inset_0px_0px_4.08px_0px_#FFFFFF40]",
            )}
          >
            {/* Dark overlay — dark mode only */}
            {!isLight ? <div className="absolute inset-0 bg-black/30" /> : null}

            {/* Top-left haze */}
            {!isLight ? (
              <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#D9D9D9]/25 blur-[120px]" />
            ) : null}

            {/* Submission card — sits inside outer shell and is clipped at the bottom */}
            <div
              className={cn(
                "relative z-10 w-full max-w-[485px] rounded-[16px] px-3.5 py-4 sm:rounded-[18px] sm:px-9 sm:py-9",
                isLight
                  ? "bg-[#F8F8F8] shadow-[0_10.18px_20.36px_0_#6C6C6C1A] border border-[#0000000D]"
                  : "border border-[#353535] bg-[#171717] shadow-[8px_8px_50px_0px_#00000080] sm:shadow-[4px_12px_4px_0px_#0000001A]",
              )}
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-3 sm:mb-7">
                <div className="min-w-0">
                  <h2
                    className={cn(
                      "text-base font-medium sm:text-xl",
                      isLight ? "text-black" : "text-[#d8d8df]",
                    )}
                  >
                    Creator Submissions
                  </h2>

                  <p
                    className={cn(
                      "mt-0.5 text-[11px] sm:text-sm",
                      isLight ? "text-black/45" : "text-[#92929a]",
                    )}
                  >
                    Payment are done after brand approves
                  </p>
                </div>

                <p
                  className={cn(
                    "shrink-0 pt-0.5 text-base font-medium sm:text-xl",
                    isLight ? "text-black" : "text-[#d8d8df]",
                  )}
                >
                  $2,000
                </p>
              </div>

              {/* Submission list */}
              <div>
                {submissions.map((submission, index) => (
                  <div
                    key={submission.name}
                    className={cn(
                      "flex items-center justify-between gap-2.5 py-2.5 sm:py-4",
                      index !== submissions.length - 1 &&
                        (isLight
                          ? "border-b border-black/[0.06]"
                          : "border-b border-white/[0.04]"),
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                      <div
                        className={cn(
                          "h-8 w-8 shrink-0 overflow-hidden rounded-full sm:h-11 sm:w-11",
                          isLight ? "bg-[#DEDEDE]" : "bg-white/10",
                        )}
                      >
                        <Image
                          src={submission.image}
                          alt={submission.name}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <h3
                          className={cn(
                            "truncate text-[13px] font-medium sm:text-[16px]",
                            isLight ? "text-black" : "text-[#dedee3]",
                          )}
                        >
                          {submission.name}
                        </h3>

                        <p
                          className={cn(
                            "mt-0.5 truncate text-[11px] sm:text-sm",
                            isLight ? "text-black/45" : "text-[#92929a]",
                          )}
                        >
                          {submission.subtitle}
                        </p>
                      </div>
                    </div>

                    {submission.approved ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium sm:px-4 sm:py-2 sm:text-sm",
                          isLight
                            ? "bg-[#E8F8F1] text-[#1EAA7D]"
                            : "bg-[#1eaa7d] text-white",
                        )}
                      >
                        ✓ Approved
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "shrink-0 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] sm:px-3 sm:py-2 sm:text-sm",
                          isLight
                            ? "border border-[#0000000D] bg-[#DEDEDE] text-black/50"
                            : "border border-white/10 bg-white/[0.02] text-[#a3a3aa]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-3 w-3 items-center justify-center rounded-full border text-[8px]",
                            isLight ? "border-black/30" : "border-[#8b8b94]",
                          )}
                        >
                          ○
                        </span>
                        Under Review
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom fade so the clipped card reads as half-merged into the shell */}
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t to-transparent sm:h-20",
                isLight ? "" : "from-[#121212]",
              )}
            />
          </div>
        </section>

        <section
          className={cn(
            "relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-10 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
          )}
        >
          <div className="relative mx-auto max-w-[1110px]">
            {isLight ? (
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[48%] h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(186,155,255,0.16)_0%,rgba(196,181,253,0.06)_45%,transparent_72%)]"
              />
            ) : null}

            {/* Heading */}
            <h2
              className={cn(
                "relative mb-10 text-center text-3xl font-bold tracking-tight leading-[1.25] sm:leading-[1.3] sm:mb-16 sm:text-4xl md:text-5xl lg:text-[52px]",
                isLight ? "text-black" : "text-white",
              )}
            >
              <span className="block mb-1 sm:mb-2.5">Everything that you need</span>
              <span>to promote brand</span>
            </h2>

            {/* TOP TWO CARDS */}
            <div className="relative grid gap-5 grid-cols-1 min-[700px]:grid-cols-2">
              {/* REAL ENGAGEMENT */}
              <div
                className={cn(
                  "relative h-[380px] overflow-hidden rounded-[18px] sm:h-[425px]",
                  isLight
                    ? "bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                    : "border border-white/10 bg-[#171717]",
                )}
              >
                {isLight ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[-10%] top-[40px] z-0 h-[220px] bg-[radial-gradient(ellipse_at_center,rgba(117,79,246,0.35)_0%,rgba(186,155,255,0.18)_45%,transparent_75%)]"
                  />
                ) : null}

                {/* Background profiles — infinite vertical scroll behind scanner */}
                <div className="absolute inset-x-0 top-6 z-[1] h-[230px] overflow-hidden sm:top-8 sm:h-[250px]">
                  {/* Top Layer: Profiles before scanner beam (gray badge with dash icon) */}
                  <div
                    className="absolute inset-0 pointer-events-none z-[1]"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 48%, 0 48%)" }}
                  >
                    <div className="animate-engagement-profiles-scroll absolute left-1/2 top-0 flex w-[230px] flex-col gap-2.5 will-change-transform">
                      {[...profiles, ...profiles, ...profiles, ...profiles].map((profile: ProfileItem, index: number) => {
                        return (
                          <div
                            key={`top-${profile.name}-${index}`}
                            className={cn(
                              "relative flex h-[42px] shrink-0 items-center gap-2 rounded-[12px] px-2",
                              isLight
                                ? "border-[0.69px] border-[#0000000D] bg-[#DEDEDE] shadow-[0px_11px_21.99px_0px_#FFFFFF5C]"
                                : "border bg-[#16161A] border-[0.69px] border-[#FFFFFF14] shadow-[0px_11px_21.99px_0px_#0000005C]",
                            )}
                          >
                            <div
                              className={cn(
                                "h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full",
                                isLight ? "bg-[#C8C8C8]" : "bg-[#292929]",
                              )}
                            >
                              <img
                                src={profile.image}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div className="min-w-0 flex-1 leading-none">
                              <div
                                className={cn(
                                  "truncate text-[11px] font-medium",
                                  isLight ? "text-black/70" : "text-white/65",
                                )}
                              >
                                {profile.name}
                              </div>
                              <div
                                className={cn(
                                  "mt-1 truncate text-[9px]",
                                  isLight ? "text-black/40" : "text-white/35",
                                )}
                              >
                                Verified Views
                              </div>
                            </div>

                            <div className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full bg-[#737373]">
                              <svg
                                viewBox="0 0 12 12"
                                className="h-2 w-2"
                                fill="none"
                              >
                                <path
                                  d="M3 6H9"
                                  stroke="black"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Layer: Profiles after passing scanner beam (green check for verified, red X for bot detected) */}
                  <div
                    className="absolute inset-0 pointer-events-none z-[2]"
                    style={{ clipPath: "polygon(0 48%, 100% 48%, 100% 100%, 0 100%)" }}
                  >
                    <div className="animate-engagement-profiles-scroll absolute left-1/2 top-0 flex w-[230px] flex-col gap-2.5 will-change-transform">
                      {[...profiles, ...profiles, ...profiles, ...profiles].map((profile: ProfileItem, index: number) => {
                        const isBad = profile.type === "bad";
                        return (
                          <div
                            key={`bottom-${profile.name}-${index}`}
                            className={cn(
                              "relative flex h-[42px] shrink-0 items-center gap-2 rounded-[12px] px-2",
                              isLight
                                ? "border-[0.69px] border-[#0000000D] bg-[#DEDEDE] shadow-[0px_11px_21.99px_0px_#FFFFFF5C]"
                                : "border border-white/[0.07] bg-[#151515]/90 shadow-[0_5px_20px_rgba(0,0,0,0.3)]",
                            )}
                          >
                            <div
                              className={cn(
                                "h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full",
                                isLight ? "bg-[#C8C8C8]" : "bg-[#292929]",
                              )}
                            >
                              <img
                                src={profile.image}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div className="min-w-0 flex-1 leading-none">
                              <div
                                className={cn(
                                  "truncate text-[11px] font-medium",
                                  isLight ? "text-black/70" : "text-white/65",
                                )}
                              >
                                {profile.name}
                              </div>
                              <div
                                className={cn(
                                  "mt-1 truncate text-[9px]",
                                  isBad
                                    ? isLight
                                      ? "text-red-600 font-medium"
                                      : "text-white/35 font-medium"
                                    : isLight
                                      ? "text-black/40"
                                      : "text-white/35",
                                )}
                              >
                                {isBad ? profile.status : "Verified Views"}
                              </div>
                            </div>

                            {isBad ? (
                              <div className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full bg-[#d92d25]">
                                <svg
                                  viewBox="0 0 12 12"
                                  className="h-2 w-2"
                                  fill="none"
                                >
                                  <path
                                    d="M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </div>
                            ) : (
                              <div className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full bg-[#26a844]">
                                <svg
                                  viewBox="0 0 12 12"
                                  className="h-2 w-2"
                                  fill="none"
                                >
                                  <path
                                    d="M2.5 6.2L4.8 8.3L9.5 3.7"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom fade overlay */}
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-0 inset-x-0 h-[45px] z-[3]",
                      isLight
                        ? "bg-gradient-to-t from-[#ECECEC] via-[#ECECEC]/90 to-transparent"
                        : "bg-gradient-to-t from-[#171717] via-[#171717]/90 to-transparent",
                    )}
                  />
                </div>

                {/* Pinched purple curve */}
                <div className="pointer-events-none absolute inset-x-0 top-[5px] min-[520px]:top-[-22px] min-[700px]:top-[10px] md:top-[0px] z-[4] flex items-center justify-center">
                  <img
                    src="/images/Vector 958.png"
                    alt=""
                    className="w-full h-auto object-contain"
                  />

                  <div className="absolute top-[38%] left-0 right-0 -translate-y-1/2 flex items-center justify-center gap-1.5 px-3 sm:gap-2.5 sm:px-4">
                    <img
                      src="/images/Frame (122312).png"
                      alt=""
                      className="hidden shrink-0 h-4 w-4 sm:h-5 sm:w-5 sm:block object-contain"
                    />
                    <span className="text-center text-[11px] font-medium tracking-[-0.02em] text-white sm:text-[14px] md:text-[15px]">
                      Authentic Data. Verified Performance
                    </span>
                  </div>
                </div>

                {/* Bottom text */}
                <div className="absolute bottom-5 left-4 right-4 z-10 sm:bottom-7 sm:left-7 sm:right-7">
                  <h3
                    className={cn(
                      "mb-2 text-[20px] font-semibold",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Real Engagement Only
                  </h3>
                  <p
                    className={cn(
                      "max-w-[480px] text-[15px] leading-[24px]",
                      isLight ? "text-black/50" : "text-[#8E8E8E]",
                    )}
                  >
                    We scan every view for suspicious activity and filter out
                    bots, clicks farms and fake traffic - so you only pay for
                    real people
                  </p>
                </div>
              </div>

              {/* CONNECTED AT SOURCE */}
              <div
                className={cn(
                  "relative h-[380px] overflow-hidden rounded-[18px] sm:h-[425px]",
                  isLight
                    ? "bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                    : "border border-white/10 bg-[#171717]",
                )}
              >
                {/* API status */}
                <div
                  className={cn(
                    "absolute left-0 right-0 top-7 z-10 text-center text-sm",
                    isLight ? "text-[#22C55E]" : "text-green-400",
                  )}
                >
                  <span className="mr-2 inline-block animate-source-api-pulse">
                    ●
                  </span>
                  API Connected
                </div>

                {/* Semicircle orbit */}
                <div className="absolute inset-x-0 top-6 bottom-[110px] overflow-visible sm:top-10 sm:bottom-[118px]">
                  {/* Extra padding so badges aren't clipped at top / left / right */}
                  <div className="absolute left-1/2 top-[68%] h-[396px] w-[396px] -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2">
                      {/* Rings — extend down smoothly with gradient fade */}
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[340px] overflow-hidden"
                        style={{
                          WebkitMaskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 75%)",
                          maskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 75%)",
                        }}
                      >
                        <div className="absolute left-1/2 top-[170px] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2">
                          <div
                            className={cn(
                              "absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border",
                              isLight
                                ? "border-black/20"
                                : "border-[0.43px] border-[#2D2D2D] shadow-[0px_2px_0px_0px_#000000]",
                            )}
                          />
                          <div
                            className={cn(
                              "absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full border",
                              isLight
                                ? "border-black/20"
                                : "border-[0.43px] border-[#2D2D2D] shadow-[0px_2px_0px_0px_#000000]",
                            )}
                          />
                        </div>
                      </div>

                      {/* Badges — 360 orbit smoothly fading on lower arc */}
                      <div
                        className="absolute -inset-x-7 -top-7 z-20 h-[396px] overflow-visible"
                        style={{
                          WebkitMaskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 65%)",
                          maskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 65%)",
                        }}
                      >
                        <div className="absolute left-1/2 top-[calc(170px+28px)] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2">
                          {/* Orbiting badges — running between inner (250px) and outer (310px) circle at 280px diameter */}
                          <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2">
                            <div className="absolute inset-0 animate-source-orbit-outer">
                              {/* Instagram (Top) */}
                              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-16 w-16 animate-source-orbit-outer-counter items-center justify-center rounded-full",
                                    isLight
                                      ? "bg-[#DEDEDE]"
                                      : "bg-[#363636] shadow-[0_8px_24px_rgba(109,70,255,0.55)]",
                                  )}
                                >
                                  <Image
                                    src="/images/Frame (3).png"
                                    alt="Instagram"
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 object-contain"
                                  />
                                </div>
                              </div>
                              {/* YouTube (Bottom) */}
                              <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-16 w-16 animate-source-orbit-outer-counter items-center justify-center rounded-full",
                                    isLight
                                      ? "bg-[#DEDEDE]"
                                      : "bg-[#363636] shadow-[0_8px_24px_rgba(109,70,255,0.55)]",
                                  )}
                                >
                                  <Image
                                    src="/images/Frame (2).png"
                                    alt="YouTube"
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 object-contain"
                                  />
                                </div>
                              </div>
                              {/* TikTok (Left) */}
                              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-16 w-16 animate-source-orbit-outer-counter items-center justify-center rounded-full",
                                    isLight
                                      ? "bg-[#DEDEDE]"
                                      : "bg-[#363636] shadow-[0_8px_24px_rgba(109,70,255,0.55)]",
                                  )}
                                >
                                  <SiTiktok
                                    className={cn(
                                      "h-8 w-8",
                                      isLight ? "text-black" : "text-white",
                                    )}
                                  />
                                </div>
                              </div>
                              {/* X (Right) */}
                              <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-16 w-16 animate-source-orbit-outer-counter items-center justify-center rounded-full",
                                    isLight
                                      ? "bg-[#DEDEDE]"
                                      : "bg-[#363636] shadow-[0_8px_24px_rgba(109,70,255,0.55)]",
                                  )}
                                >
                                  <Image
                                    src="/images/Frame (4).png"
                                    alt="X"
                                    width={28}
                                    height={28}
                                    className="h-7 w-7 object-contain"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Center logo */}
                      <div
                        className={cn(
                          "absolute left-1/2 top-[45%] z-30 flex h-[90px] w-[90px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                          isLight
                            ? "bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                            : "bg-[#1c1c1c]",
                        )}
                      >
                        {!isLight ? (
                          <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_92%,rgba(124,58,237,0.95),transparent_56%)]" />
                        ) : null}
                        <Image
                          src={
                            isLight
                              ? "/images/Group (1).png"
                              : "/images/Group@2x.png"
                          }
                          alt="Game of Creators"
                          width={48}
                          height={48}
                          className="relative z-10 h-12 w-12 object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom text */}
                <div className="absolute bottom-5 left-4 right-4  sm:bottom-7 sm:left-7 sm:right-7">
                  <h3
                    className={cn(
                      "mb-2 text-[20px] font-semibold",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Connected at the source
                  </h3>

                  <p
                    className={cn(
                      "max-w-[480px] text-[15px] leading-[24px]",
                      isLight ? "text-black/50" : "text-[#8E8E8E]",
                    )}
                  >
                    Campaign data is pulled directly from Instagram and YouTube,
                    giving you verified performance instead of self-reported
                    numbers.
                  </p>
                </div>
              </div>
            </div>

            {/* CAMPAIGN CARD */}
            <div
              className={cn(
                "relative mt-6 w-full overflow-hidden rounded-[16px] px-4 pt-6 pb-0 sm:rounded-[20px] sm:px-6 sm:pt-8 sm:pb-0 lg:px-9 lg:pt-9 lg:pb-0",
                isLight
                  ? "bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                  : "border border-white/10 bg-[#151515]",
              )}
            >
              <div className="relative flex flex-col min-[1000px]:min-h-[430px] min-[1000px]:flex-row">
                {/* LEFT CONTENT */}
                <div className="relative z-30 w-full shrink-0 pb-6 min-[1000px]:w-[260px] min-[1000px]:pb-9 lg:w-[310px]">
                  <h2
                    className={cn(
                      "text-[20px] font-semibold tracking-[-0.4px] sm:text-[22px]",
                      isLight ? "text-black" : "text-white/80",
                    )}
                  >
                    Run Campaigns, Your way.
                  </h2>

                  <p
                    className={cn(
                      "mt-2 max-w-[310px] text-[14px] leading-[22px] sm:max-w-[300px] sm:text-[16px] sm:leading-[24px]",
                      isLight ? "text-black/50" : "text-[#8E8E8E]",
                    )}
                  >
                    Choose the format that fits your goals - from guaranteed reach to performance-based rewards
                  </p>
                </div>

                {/* CARDS AREA — horizontal scroll on small screens, fan on min-[1000px]+ */}
                <div className="relative -mx-4 mt-2 overflow-x-auto overflow-y-hidden pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-[1000px]:absolute min-[1000px]:left-[240px] min-[1000px]:top-[-16px] min-[1000px]:bottom-0 min-[1000px]:mx-0 min-[1000px]:mt-0 min-[1000px]:h-auto min-[1000px]:w-[calc(100%-210px)] min-[1000px]:overflow-visible lg:left-[280px] lg:w-[calc(100%-240px)] 2xl:left-[300px]">
                  <div className="relative h-[440px] w-[780px] sm:h-[475px] sm:w-[860px] min-[1000px]:h-[485px] min-[1000px]:w-full">
                    {/* ================= CPM CARD ================= */}
                    <div
                      className="
              absolute left-0 bottom-0 z-[10]
              h-[410px] w-[240px]
              overflow-hidden rounded-t-[20.5px] rounded-b-none
              bg-[linear-gradient(180deg,#754FF6_0%,#221845_100%)]
              shadow-2xl
              sm:h-[445px] sm:w-[270px] min-[1000px]:h-[455px]
            "
                    >
                      <div className="px-5 pt-6">
                        <h3 className="text-[21px] font-bold text-white">
                          CPM
                        </h3>

                        <p className="mt-[-2px] text-[15px] text-white/90">
                          pay per 1k verified views
                        </p>
                      </div>

                      {/* Video container */}
                      <div className="absolute left-[16px] right-[16px] top-[88px] bottom-0 overflow-hidden rounded-t-[14px] bg-white">
                        {/* top controls */}
                        <div className="absolute left-0 right-0 top-0 z-10 flex h-[45px] items-center justify-between bg-white px-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eee]">
                            <svg
                              width="11"
                              height="13"
                              viewBox="0 0 11 13"
                              fill="none"
                            >
                              <path d="M10 6.5L1 1V12L10 6.5Z" fill="#754FF6" />
                            </svg>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <svg width="13" height="13" viewBox="0 0 24 24">
                              <path
                                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                              />
                              <circle
                                cx="12"
                                cy="12"
                                r="3"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                            125K
                          </div>
                        </div>

                        {/* Person/video image */}
                        <div className="absolute inset-x-0 top-[45px] bottom-0">
                          <Image
                            src="/images/01d7112f99a9d9cf991c9fb42b1f697eeeafc875.png"
                            alt="Creator"
                            fill
                            className="object-cover"
                          />

                          {/* video dark gradient */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                          {/* <div className="absolute bottom-4 left-3 right-3 text-center text-[11px] text-white/50">
                  since I started posting
                  <br />
                  on social media
                </div> */}
                        </div>
                      </div>
                    </div>

                    {/* ================= LEADERBOARD CARD ================= */}
                    <div
                      className="
              absolute left-[160px] bottom-0 z-[20]
              h-[390px] w-[240px]
              overflow-hidden rounded-t-[20.5px] rounded-b-none
              bg-[linear-gradient(180deg,#F6BE4F_0%,#453418_100%)]
              shadow-2xl
              sm:left-[190px] sm:h-[425px] sm:w-[270px] min-[1000px]:h-[435px]
            "
                      style={{ transform: "rotate(2.5deg)", transformOrigin: "bottom left" }}
                    >
                      <div className="px-5 pt-6">
                        <h3 className="text-[21px] font-bold text-white">
                          Leaderboard
                        </h3>

                        <p className="max-w-[180px] text-[14px] leading-[18px] text-white">
                          Compete for top ranks and
                          <br />
                          earn more
                        </p>
                      </div>

                      {/* Gold decorative circles */}
                      <div className="absolute right-[20px] top-[55px] h-[90px] w-[90px] rounded-full bg-[#d9941d]/50" />
                      <div className="absolute right-[-15px] top-[5px] h-[100px] w-[100px] rounded-full bg-[#ffe17c]/40" />

                      {/* Decorative white accent lines above top-left of white panel */}
                      <div className="pointer-events-none absolute left-[18px] top-[90px] h-[12px] w-[2px] origin-bottom rotate-[-22deg] rounded-full bg-white opacity-95" />
                      <div className="pointer-events-none absolute left-[10px] top-[96px] h-[10px] w-[2px] origin-bottom rotate-[-52deg] rounded-full bg-white opacity-95" />

                      {/* Leaderboard white panel */}
                      <div className="absolute left-[16px] right-[16px] top-[108px] bottom-0 rounded-t-[13px] bg-white px-4 pt-4">
                        <h4 className="text-[15px] font-semibold text-[#272727]">
                          Top Creators
                        </h4>

                        <p className="text-[10px] text-gray-500">
                          See who's leading this campaign
                        </p>

                        <div className="mt-4 space-y-[13px]">
                          {creators.map((creator, index) => (
                            <div
                              key={creator.name}
                              className="flex items-center gap-2"
                            >
                              <span className="w-[13px] text-[8px] text-gray-500">
                                {index + 1}
                              </span>

                              <Image
                                src={creator.image}
                                alt={creator.name}
                                width={21}
                                height={21}
                                className="h-[21px] w-[21px] rounded-full object-cover"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="text-[8px] font-medium text-gray-700">
                                  {creator.name}
                                </div>

                                <div className="mt-[3px] h-[3px] w-full rounded-full bg-gray-200">
                                  <div
                                    className="h-full rounded-full bg-[#FF8800]"
                                    style={{
                                      width: `${Math.max(
                                        30,
                                        100 - index * 10,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ================= MILESTONE CARD ================= */}
                    <div
                      className="
              absolute left-[310px] bottom-0 z-[30]
              h-[380px] w-[240px]
              overflow-hidden rounded-t-[20.5px] rounded-b-none
              bg-[linear-gradient(180deg,#F64FDA_0%,#221845_100%)]
              shadow-2xl
              sm:left-[360px] sm:h-[415px] sm:w-[270px] min-[1000px]:h-[425px]
            "
                      style={{ transform: "rotate(4deg)", transformOrigin: "bottom left" }}
                    >
                      <div className="px-5 pt-6">
                        <h3 className="text-[21px] font-bold text-white">
                          Milestone
                        </h3>

                        <p className="max-w-[180px] text-[14px] leading-[18px] text-white">
                          Hit view goals and
                          <br />
                          unlock rewards
                        </p>
                      </div>

                      {/* White milestone panel */}
                      <div className="absolute left-[16px] right-[16px] top-[110px] bottom-0 rounded-t-[14px] bg-white px-5 pt-5">
                        <h4 className="text-[15px] font-semibold text-gray-800">
                          Milestone
                        </h4>

                        <p className="text-[10px] text-gray-500">
                          Rewards at every step
                        </p>

                        {/* Timeline */}
                        <div className="relative mt-5">
                          <div className="absolute left-[9px] top-[10px] bottom-[46px] w-[2px] bg-[#ff4fc9]" />

                          {/* 100K */}
                          <div className="relative flex gap-3">
                            <div className="relative z-10 flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff28a8]">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path
                                  d="M5 12l4 4L19 6"
                                  stroke="white"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>

                            <div className="rounded-[12px] bg-[#fff4fa] px-4 py-3">
                              <p className="text-[13px] font-semibold text-gray-800">
                                100K views
                              </p>
                              <p className="text-[10px] text-gray-500">
                                ₹5,000 reward
                              </p>
                            </div>
                          </div>

                          {/* 500K */}
                          <div className="relative mt-3 flex gap-3">
                            <div className="relative z-10 h-[20px] w-[20px] shrink-0 rounded-full border-2 border-[#ff8bd6] bg-white" />

                            <div className="rounded-[12px] bg-[#fff4fa] px-4 py-3">
                              <p className="text-[13px] font-semibold text-gray-800">
                                500K views
                              </p>
                              <p className="text-[10px] text-gray-500">
                                ₹15,000 reward
                              </p>
                            </div>
                          </div>

                          {/* 1M */}
                          <div className="relative mt-3 flex gap-3">
                            <div className="relative z-10 h-[20px] w-[20px] shrink-0 rounded-full border-2 border-[#ff8bd6] bg-white" />

                            <div className="rounded-[12px] bg-[#fff4fa] px-4 py-3">
                              <p className="text-[13px] font-semibold text-gray-800">
                                1M views
                              </p>
                              <p className="text-[10px] text-gray-500">
                                ₹50,000 reward
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ================= DUAL REWARDS CARD ================= */}
                    <div
                      className="
              absolute left-[460px] bottom-0 z-[40]
              h-[370px] w-[250px]
              overflow-hidden rounded-t-[20.5px] rounded-b-none
              bg-[linear-gradient(180deg,#4FBEF6_0%,#221845_100%)]
              shadow-2xl
              sm:left-[540px] sm:h-[400px] sm:w-[300px] min-[1000px]:h-[410px]
            "
                      style={{ transform: "rotate(5.5deg)", transformOrigin: "bottom left" }}
                    >
                      <div className="px-5 pt-6">
                        <h3 className="text-[21px] font-bold text-white">
                          Dual Rewards
                        </h3>

                        <p className="text-[15px] text-white">
                          CPM + Milestones
                        </p>
                      </div>

                      {/* Main reward white panel */}
                      <div className="absolute left-[16px] right-[16px] top-[105px] bottom-0 rounded-t-[13px] bg-white/90 px-3 pt-4">
                        {/* CPM reward */}
                        <div className="relative rounded-[11px] bg-[#CDEDFF] px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center">
                              <svg
                                width="18"
                                height="21"
                                viewBox="0 0 18 21"
                                fill="none"
                              >
                                <path
                                  d="M16 10.5L1 2V19L16 10.5Z"
                                  fill="#00A5FF"
                                />
                              </svg>
                            </div>

                            <div>
                              <div className="text-[17px] font-semibold leading-[19px] text-[#00A5FF]">
                                $1.00
                              </div>

                              <div className="text-[13px] leading-[16px] text-[#00A5FF]">
                                per 1,000 view
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Plus */}
                        <div className="relative z-10 mx-auto my-[-3px] flex h-[40px] w-[40px] items-center justify-center">
                          <div className="absolute h-[4px] w-[32px] rounded-full bg-[#00A5FF]" />
                          <div className="absolute h-[32px] w-[4px] rounded-full bg-[#00A5FF]" />
                        </div>

                        {/* Milestone reward */}
                        <div className="rounded-[11px] bg-[#CDEDFF] px-4 py-4">
                          <div className="flex items-start gap-3">
                            {/* bars icon */}
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="mt-1 shrink-0"
                            >
                              <path
                                d="M5 19V12M12 19V5M19 19V9"
                                stroke="#00A5FF"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>

                            <div className="text-[#00A5FF]">
                              <div className="text-[16px] font-semibold leading-[20px]">
                                $25
                                <span className="font-normal">
                                  {" "}
                                  at 25K views
                                </span>
                              </div>

                              <div className="text-[16px] font-semibold leading-[20px]">
                                $50
                                <span className="font-normal">
                                  {" "}
                                  at 50K views
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom fade */}
                        <div className="absolute bottom-0 left-0 right-0 h-[90px] bg-gradient-to-t from-white via-white/80 to-transparent" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "px-4 py-12 sm:px-6 sm:py-20 md:py-24 transition-colors duration-300 flex items-center justify-center min-h-[500px] sm:min-h-[600px]",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
          )}
        >
          <div className="mx-auto w-full max-w-[1100px] px-2 sm:px-4">
            {/* Testimonial Card */}
            <div
              className={cn(
                "relative mx-auto overflow-hidden rounded-[28px] sm:rounded-[32px] transition-all duration-300 border flex flex-col lg:flex-row items-stretch",
                isLight
                  ? "bg-white border-black/10 shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
                  : "bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] border-[#353535] shadow-[0_10px_40px_rgba(0,0,0,0.5)]",
              )}
            >
              {/* Left: Image Card (Full cover left, top & bottom) */}
              <div className="relative w-full lg:w-[384px] h-[380px] sm:h-[440px] lg:h-auto lg:min-h-[482px] flex-shrink-0 overflow-hidden">
                <Image
                  src="/images/ranveer_testimonial.png"
                  alt="Ranveer Allahbadia"
                  fill
                  priority
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 384px"
                />
                {/* Bottom gradient overlay for author text */}
                <div className="absolute bottom-0 left-0 right-0 h-[140px] bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

                {/* Author Details overlay */}
                <div className="absolute left-6 lg:left-[35px] bottom-6 lg:bottom-[35px] flex flex-col items-start justify-start z-10 text-left">
                  <div className="text-[#F1F1F1] text-lg sm:text-[20px] font-semibold leading-snug sm:leading-[30px]">
                    Ranveer Allahbadia
                  </div>
                  <div className="text-[#A8A8A8] text-sm sm:text-[16px] font-normal leading-normal sm:leading-[24px]">
                    Founder, BeerBiceps
                  </div>
                </div>
              </div>

              {/* Right: Content & Metrics */}
              <div className="flex-1 flex flex-col justify-center items-start gap-4 sm:gap-5 text-left p-6 sm:p-10 lg:py-12 lg:pr-[52px] lg:pl-12 max-w-[760px]">
                {/* Campaign subtitle badge */}
                <div className="text-[#757575] text-xs sm:text-[14px] font-medium leading-[21px]">
                  Ran 3+ campaigns on GOC
                </div>

                {/* Main Quote */}
                <div className="w-full">
                  <p className="text-xl sm:text-2xl lg:text-[32px] font-medium leading-relaxed sm:leading-[44px] lg:leading-[48px] tracking-tight">
                    <span className={isLight ? "text-black" : "text-[#DEDEDE]"}>
                      “GOC helped us move{" "}
                    </span>
                    <span className="text-[#8E8E8E]">
                      from paying for reach to understanding the actual performance behind every piece of content. The visibility made campaign decisions much easier.
                    </span>
                    <span className={isLight ? "text-black" : "text-[#DEDEDE]"}>
                      ”
                    </span>
                  </p>
                </div>

                {/* Divider line */}
                <div
                  className={cn(
                    "w-full h-[1px] my-1 sm:my-3",
                    isLight ? "bg-black/10" : "bg-[#353535]",
                  )}
                />

                {/* Metrics Box */}
                <div className="w-full flex items-center justify-between sm:justify-start gap-6 sm:gap-12 md:gap-16 pt-1 sm:pt-2">
                  {/* Stat 1 */}
                  <div className="flex flex-col justify-center items-start gap-1">
                    <div className={cn("text-3xl sm:text-4xl lg:text-[52px] font-semibold leading-tight lg:leading-[57.2px]", isLight ? "text-purple-600" : "text-[#F1EDFE]")}>
                      2.5M+
                    </div>
                    <div className="text-[#8E8E8E] text-xs sm:text-[15px] font-normal leading-tight sm:leading-[21px]">
                      Views generated
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div
                    className={cn(
                      "w-[1px] h-12 sm:h-16 self-stretch",
                      isLight ? "bg-black/10" : "bg-[#434343]",
                    )}
                  />

                  {/* Stat 2 */}
                  <div className="flex flex-col justify-center items-start gap-1">
                    <div className={cn("text-3xl sm:text-4xl lg:text-[52px] font-semibold leading-tight lg:leading-[57.2px]", isLight ? "text-purple-600" : "text-[#F1EDFE]")}>
                      16%
                    </div>
                    <div className="text-[#8E8E8E] text-xs sm:text-[15px] font-normal leading-tight sm:leading-[21px]">
                      Engagement Rate
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "relative min-h-[640px] overflow-hidden px-4 py-14 sm:min-h-[780px] sm:px-5 sm:py-20 md:min-h-[900px] md:py-24 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
          )}
        >
          {/* Background glow */}
          {isLight ? (
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[58%] h-[520px] w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(186,155,255,0.55)_0%,rgba(196,181,253,0.28)_38%,rgba(241,241,241,0)_72%)] blur-[2px] sm:h-[640px] sm:w-[1100px]"
            />
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[381px] h-[676px] w-[1174px] -translate-x-1/2 rounded-full bg-[#D9D9D933] blur-[148px]"
            />
          )}

          {/* Top content */}
          <div className="relative z-20 mx-auto max-w-3xl text-center">
          <h2
  className={cn(
    "font-['Inter'] font-bold tracking-[-3%] text-center text-3xl sm:text-4xl md:text-5xl lg:text-[52px]",
    isLight ? "text-black" : "text-[#EFEFEF]",
  )}
>
  <span className="block">The results gets sharper</span>
  <span className="mt-3 block">with every campaign.</span>
</h2>

            <p
              className={cn(
                "mx-auto mt-6 max-w-[780px] text-[17px] leading-7 sm:mt-8",
                isLight ? "text-black/50" : "text-[#8E8E8E]",
              )}
            >
              More campaigns mean more creators participating, more content, and
              more performance data — which makes it easier to see what a
              creator or a piece of content is likely to do next time
            </p>

            <button
              type="button"
              onClick={handleLaunchCampaign}
              disabled={isLaunchingCampaign}
              className={cn(
                "mt-6 inline-flex items-center gap-3 rounded-xl px-4 py-3 text-[12px] md:text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-70",
                isLight
                  ? "bg-black text-white hover:bg-black/90 shadow-[0_10px_30px_rgba(15,15,30,0.12)]"
                  : "border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.4)] hover:bg-white/10",
              )}
            >
              {isLaunchingCampaign ? <ButtonLoadingSpinner /> : null}
              <span>Launch a Campaign</span>
              <span className="text-lg">→</span>
            </button>
          </div>

          {/* Map */}
          <div
            ref={mapRef}
            className="relative mx-auto mt-8 h-[320px] w-full max-w-[1250px] sm:mt-12 sm:h-[420px] md:h-[520px] lg:h-[580px]"
          >
            {isLight ? (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 z-0 h-[70%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.35)_0%,transparent_68%)] blur-3xl",
                  mapInView && "animate-map-glow-pulse",
                )}
              />
            ) : null}
            <div
              className={cn(
                "absolute inset-0",
                mapInView && "",
              )}
            >
              <Image
                src={
                  isLight
                    ? "/images/6c7b71cf5612b7b0ce48a83d308567260c8756d0.png"
                    : WorldMapDots
                }
                alt=""
                fill
                priority
                className={cn(
                  "object-cover object-center",
                  isLight && "mix-blend-screen",
                )}
                sizes="(max-width: 1280px) 100vw, 1250px"
              />
            </div>

            {/* Connection lines */}
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {people.map((person, index) => (
                <path
                  key={`connector-${person.name}-${index}`}
                  d={connectionPath(person)}
                  fill="none"
                  stroke={isLight ? "#7c3aed" : "#A3A3A3"}
                  strokeOpacity={isLight ? 0.35 : 0.35}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {/* Center campaign marker */}
            <div
              className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 sm:h-14 sm:w-14"
              style={{
                left: `${campaignCenter.x}%`,
                top: `${campaignCenter.y}%`,
              }}
            >
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center rounded-full shadow-[0_0_30px_rgba(124,58,237,0.25)]",
                  isLight
                    ? "border border-black/10 bg-black"
                    : "border border-white/50 bg-black shadow-[0_0_30px_rgba(255,255,255,0.15)]",
                )}
              >
                <div className="flex h-5 w-5 items-center justify-center sm:h-7 sm:w-7">
                  <img
                    src="/images/Group@2x.png"
                    alt="Play"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              <div
                className={cn(
                  "absolute left-1/2 top-full mt-1 -translate-x-1/2 overflow-hidden rounded-full px-3 py-1 text-center text-[10px] font-medium shadow-lg sm:mt-2 sm:px-5 sm:py-2 sm:text-sm",
                  isLight
                    ? "border border-black/10 bg-white text-black"
                    : "bg-[linear-gradient(180deg,#DEDEDE_0%,#787878_100%)] border border-[#BABABA] text-black backdrop-blur",
                  "[perspective:480px]",
                )}
              >
                <span
                  key={`center-${mapStage}`}
                  className="inline-block animate-map-text-rotate whitespace-nowrap"
                >
                  {activeMapStage.centerLabel}
                </span>
              </div>
            </div>

            {/* People */}
            {people.map((person, index) => (
              <div
                key={`${person.name}-${index}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{
                  left: `${person.x}%`,
                  top: `${person.y}%`,
                }}
              >
                <div
                  className={cn(
                    "mx-auto h-7 w-7 overflow-hidden rounded-full bg-neutral-800 sm:h-11 sm:w-11",
                    isLight
                      ? "border-2 border-[#93c5fd] shadow-[0_0_0_3px_rgba(147,197,253,0.35)]"
                      : "border-2 border-white/80 shadow-[0_0_0_3px_rgba(0,0,0,0.7)]",
                  )}
                >
                  <img
                    src={person.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Location pin */}
                <div
                  className={cn(
                    "mx-auto -mt-1 h-1.5 w-1.5 rotate-45 rounded-[1px] sm:h-2 sm:w-2",
                    isLight ? "bg-[#93c5fd]" : "bg-white/80",
                  )}
                />

                <p
                  className={cn(
                    "mt-0.5 hidden overflow-hidden whitespace-nowrap text-sm font-medium sm:mt-1 sm:block",
                    isLight ? "text-black/70" : "text-white",
                    "[perspective:480px]",
                  )}
                >
                  <span
                    key={`person-${index}-${mapStage}`}
                    className="inline-block animate-map-text-rotate"
                  >
                    {activeMapStage.personLabel(person.name)}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* Bottom fade */}
          {!isLight ? (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black via-black/70 to-transparent" />
          ) : null}
        </section>
        {/* Gaming Brand Testimonials Section */}
        <Testimonials />
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                What Brands Say About Us
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-violet-500 to-purple-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  stars: 5,
                  quote:
                    "Game Of Creators revolutionized our content strategy. We received over 50 unique content pieces in just two weeks, and our engagement rates went through the roof.",
                  name: "Sarah Johnson",
                  title: "Marketing Director, Fashion Brand",
                },
                {
                  stars: 5,
                  quote:
                    "Working with talented creators on this platform has been a breeze. The quality of content exceeded our expectations, and we saw a significant ROI.",
                  name: "Mike Chen",
                  title: "Founder, Tech Startup",
                },
                {
                  stars: 4,
                  quote:
                    "The campaign feature is fantastic for discovering new talent. We've found some hidden gems who are now regular contributors to our brand.",
                  name: "David Miller",
                  title: "Head of Content, Food & Beverage Co.",
                },
                {
                  stars: 5,
                  quote:
                    "The platform's analytics helped us identify our best-performing content creators. We've scaled our campaigns 300% while reducing costs by 60%.",
                  name: "Emma Rodriguez",
                  title: "CMO, E-commerce Platform",
                },
                {
                  stars: 5,
                  quote:
                    "Game Of Creators delivered results beyond our expectations. The quality and authenticity of content from creators has transformed our brand presence.",
                  name: "James Wilson",
                  title: "Brand Manager, Consumer Goods",
                },
                {
                  stars: 4,
                  quote:
                    "Finally, a platform that understands both brand needs and creator capabilities. The collaboration process is seamless and results-driven.",
                  name: "Lisa Chen",
                  title: "Head of Digital Marketing, SaaS Company",
                },
              ].map((testimonial, index) => (
                <div key={index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-purple-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-violet-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full flex flex-col">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < testimonial.stars
                              ? "text-violet-400 fill-violet-400"
                              : "text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="italic text-slate-300 mb-6 flex-grow leading-relaxed">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center mt-auto">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold mr-4">
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {testimonial.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {testimonial.title}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* Gaming FAQ Section */}
        <FAQ />
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                  FAQ
                </h2>
                <p className="text-xl text-slate-300">
                  Here are some frequently asked questions
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqItemsBrands.map((item, index) => (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border-0"
                  >
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md rounded-2xl border border-slate-600/50 hover:border-violet-400/50 transition-all duration-300 overflow-hidden">
                      <AccordionTrigger className="text-left text-lg md:text-xl hover:no-underline px-8 py-6 text-white font-semibold">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {(index + 1).toString().padStart(2, "0")}
                          </span>
                          <span>{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-300 text-lg leading-relaxed px-8 pb-6">
                        <div className="pl-12">{item.answer}</div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section> */}

        {/* Epic Final CTA */}
        <CtcBanner />

        <Dialog open={showCreatorModal} onOpenChange={setShowCreatorModal}>
          <DialogContent className="bg-[#0A0A0A] rounded-2xl shadow-2xl sm:max-w-xl p-8">
            <DialogHeader>
              <DialogTitle className="text-xl mb-4 lg:text-2xl leading-tight font-semibold bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent ">
                You&apos;re logged in as{" "}
                <span
                  // style={{
                  //   background:
                  //     "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                  //   WebkitBackgroundClip: "text",
                  //   WebkitTextFillColor: "transparent",
                  //   backgroundClip: "text",
                  // }}
                >
                  a creator
                </span>
              </DialogTitle>
              <DialogDescription className="text-base text-slate-400 leading-relaxed">
                To continue as a brand, please sign out from your creator
                account first, then sign up or log in as a brand.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                className="inline-flex w-full items-center justify-center gap-2 border-white bg-white text-black px-6 py-5 sm:w-auto"
                onClick={handleContinueAsCreator}
                disabled={isSigningOut || isLaunchingCampaign}
              >
                {isLaunchingCampaign ? <ButtonLoadingSpinner /> : null}
                <span>Continue as Creator</span>
              </Button>
              <Button
                className="inline-flex w-full items-center justify-center gap-2 text-white border border-white/20  bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]  px-6 py-5 sm:w-auto"
                onClick={handleSignOutAndContinueBrand}
                disabled={isSigningOut || isLaunchingCampaign}
              >
                {isSigningOut ? <ButtonLoadingSpinner /> : null}
                <span>Sign out & Continue as Brand</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-900/30 via-purple-900/30 to-indigo-900/30 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-8">
                <Crown className="h-16 w-16 text-violet-400/60 mx-auto mb-6" />
              </div>

              <h2 className="text-4xl md:text-6xl font-black mb-8 text-white drop-shadow-2xl">
                Ready to Transform Your{" "}
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  Content Strategy
                </span>
                ?
              </h2>

              <p className="text-xl text-slate-300 mb-12 leading-relaxed">
                Launch your first campaign today and witness the power of
                creator-generated content.
              </p>

              <BrandLaunchContestButton />
            </div>
          </div>
        </section> */}
      </div>
    </div>
  );
}
