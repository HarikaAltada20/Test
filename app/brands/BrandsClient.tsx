"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  WalletCards,
  ArrowUpRight,
  Megaphone,
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
  "/images/song-gpt.logo.avif",
  "/images/vows-streams-logo.avif",
  "/images/catch-phrase.avif",
  "/images/deepvid.avif",
  "/images/warner-music.avif",
  "/images/sony.avif",
  "/images/10k-projects.avif",
  "/images/ada.avif",
  "/images/artistpg.avif",
  "/images/capital-music.avif",
  "/images/create-music-group.avif",
  "/images/empire-distribution.avif",
];
interface BrandsClientProps {
  totalViews: number;
  initialTheme?: "light" | "dark";
}

const features = [
  {
    icon: UserRound,
    title: "Content Before It Goes Live",
    description:
      "Review and approve creator content before it reaches your audience.",
  },
  {
    icon: CheckCircle2,
    title: "Verified, Not Self-Reported",
    description: "Real platform data. Verified views. No inflated numbers.",
  },
  {
    icon: Eye,
    title: "One Campaign. Full Visibility.",
    description:
      "Track content, creators, spend, and performance from one place.",
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
    name: "Alex Joined",
    x: 19,
    y: 28,
    arc: 8,
    avatar: "https://i.pravatar.cc/100?img=12",
  },
  {
    name: "Leela Joined",
    x: 66,
    y: 23,
    arc: 6,
    avatar: "https://i.pravatar.cc/100?img=47",
  },
  {
    name: "Mukesh Joined",
    x: 66,
    y: 42,
    arc: 4,
    avatar: "https://i.pravatar.cc/100?img=11",
  },
  {
    name: "Sameer Joined",
    x: 27,
    y: 69,
    arc: 10,
    avatar: "https://i.pravatar.cc/100?img=13",
  },
  {
    name: "Sameer Joined",
    x: 84,
    y: 69,
    arc: 10,
    avatar: "https://i.pravatar.cc/100?img=33",
  },
];

const connectionPath = ({ x, y, arc }: Person) => {
  const controlX = (x + campaignCenter.x) / 2;
  const controlY = (y + campaignCenter.y) / 2 - arc;
  return `M ${x} ${y} Q ${controlX} ${controlY} ${campaignCenter.x} ${campaignCenter.y}`;
};

const profiles = [
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
        "min-h-screen overflow-x-hidden transition-colors duration-300",
        isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
      )}
    >
      <div className="relative z-20">
        {/* Floating Gaming Elements */}
        <main
          className={cn(
            "min-h-screen overflow-x-hidden transition-colors duration-300",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
          )}
        >
          {/* Hero */}
          <section className="relative mx-auto max-w-[1080px] px-4 pt-10 text-center sm:px-6 sm:pt-14 md:pt-16">
            <div className="relative z-10">
              <h1
                className={cn(
                  "mx-auto max-w-[700px] text-[28px] font-bold leading-[1.1] tracking-[-1.2px] sm:text-[36px] sm:tracking-[-1.5px] md:text-[48px] md:tracking-[-1.8px]",
                  isLight ? "text-black" : "text-white/90",
                )}
              >
                Pay creators based on
                <br />
                how their content performs.
              </h1>

              <p
                className={cn(
                  "mx-auto mt-4 max-w-[640px] text-[14px] leading-6 sm:mt-5 sm:text-[15px] md:text-[16px]",
                  isLight ? "text-black/50" : "text-white/50",
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
                    "group inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto",
                    isLight
                      ? "bg-black text-white hover:bg-black/90"
                      : "border border-white/20 bg-black/50 shadow-[0_0_20px_rgba(255,255,255,0.03)] hover:bg-white/10",
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
                    "group flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition sm:w-auto",
                    isLight
                      ? "border border-black/10 bg-white text-black hover:bg-white shadow-[0_8px_24px_rgba(15,15,30,0.06)]"
                      : "bg-white text-black hover:bg-white/90",
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
                "rounded-[20px] p-1.5 sm:rounded-[30px] sm:p-2",
                isLight
                  ? "bg-white"
                  : "bg-[#242424] shadow-[0_30px_100px_rgba(88,54,150,0.25)]",
              )}
            >
              {/* Main dashboard card */}
              <div
                className={cn(
                  "relative min-h-[320px] overflow-hidden rounded-[18px] sm:min-h-[450px] sm:rounded-[22px]",
                  isLight
                    ? "border border-black/[0.06] bg-white"
                    : "border border-white/[0.04] bg-[#151515]",
                )}
              >
                {/* Dashboard image behind purple glow */}
                <div className="pointer-events-none absolute inset-0">
                  <Image
                    src={
                      isLight
                        ? "/images/5c1bc9327aecb9290b3284179d46d09ae2c7635c.png"
                        : "/images/2398b700eadec2cb27b247febe9b4b7935fa92d0.png"
                    }
                    alt=""
                    fill
                    className={cn(
                      "object-cover object-left-top sm:object-[20%_0%]",
                      isLight
                        ? "opacity-70 sm:opacity-85"
                        : "opacity-40 sm:opacity-50",
                    )}
                    sizes="(max-width: 1100px) 100vw, 1100px"
                    priority
                  />
                  {/* Soft fade so left copy stays readable */}
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-r to-transparent",
                      isLight
                        ? "from-white via-white sm:via-white/90"
                        : "from-[#151515] via-[#151515]/85 sm:via-[#151515]/70",
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t via-transparent",
                      isLight
                        ? "from-white to-white/50"
                        : "from-[#151515] to-[#151515]/40",
                    )}
                  />
                </div>

                {/* Purple glow */}
                <div className="absolute bottom-[-160px] right-[-100px] z-[1] h-[400px] w-[650px] rounded-full bg-[#8869ff]/55 blur-[100px]" />

                {/* Content */}
                <div className="relative z-10 flex min-h-[280px] flex-col justify-center px-5 py-10 sm:min-h-[390px] sm:px-8 sm:py-12 md:px-10">
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

                  <button
                    type="button"
                    onClick={handleLaunchCampaign}
                    disabled={isLaunchingCampaign}
                    className={cn(
                      "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit",
                      isLight
                        ? "bg-black text-white hover:bg-black/90"
                        : "bg-white text-black hover:bg-white/90",
                    )}
                  >
                    {isLaunchingCampaign ? <ButtonLoadingSpinner /> : null}
                    <span>Launch a Campaign</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Feature cards */}
              <div
                className={cn(
                  "mt-3 grid grid-cols-1 gap-6 rounded-[18px] p-5 sm:gap-3 sm:rounded-[22px] sm:p-7 md:grid-cols-3",
                  isLight ? "bg-[#f7f7f7]" : "bg-[#151515]",
                )}
              >
                {features.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div key={feature.title}>
                      <div
                        className={cn(
                          "mb-4 flex h-7 w-7 items-center justify-center rounded-full",
                          isLight
                            ? "bg-black/5 text-black/70"
                            : "bg-white/10 text-white/80",
                        )}
                      >
                        <Icon size={15} strokeWidth={1.8} />
                      </div>

                      <h3
                        className={cn(
                          "text-[15px] font-semibold",
                          isLight ? "text-black" : "text-white/90",
                        )}
                      >
                        {feature.title}
                      </h3>

                      <p
                        className={cn(
                          "mt-2 max-w-[230px] text-[13px] leading-5",
                          isLight ? "text-black/45" : "text-white/40",
                        )}
                      >
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        {/* Infinite Scroll Images Section */}
        <section
          className={cn(
            "pb-12 overflow-hidden transition-colors duration-300",
            isLight ? "bg-[#F1F1F1]" : "bg-black",
          )}
        >
          <div className="overflow-hidden relative scroll-container-testimonials">
            <div className="flex justify-center items-center gap-6 animate-scroll-left">
              {[...brandImages, ...brandImages].map((image, index) => {
                const isLarge =
                  image === "/images/vows-streams-logo.avif" ||
                  image === "/images/song-gpt.logo.avif";
                const isCatchPhrase = image === "/images/catch-phrase.avif";
                const allImages = [...brandImages, ...brandImages];
                const nextImage =
                  index < allImages.length - 1 ? allImages[index + 1] : null;
                const isNextToLarge =
                  (isLarge || isCatchPhrase) &&
                  nextImage &&
                  (nextImage === "/images/vows-streams-logo.avif" ||
                    nextImage === "/images/song-gpt.logo.avif" ||
                    nextImage === "/images/catch-phrase.avif");
                return (
                  <div
                    key={index}
                    className={`flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${
                      isCatchPhrase
                        ? "w-[160px] h-[96px] md:w-[200px] md:h-[120px]"
                        : isLarge
                          ? "w-[180px] h-[108px] md:w-[240px] md:h-[190px]"
                          : "w-[120px] h-[72px] md:w-[150px] md:h-[90px]"
                    } ${isNextToLarge ? "-mr-4 md:-mr-8" : ""}`}
                  >
                    <Image
                      src={image}
                      alt={`Brand image ${index + 1}`}
                      width={isCatchPhrase ? 200 : isLarge ? 235 : 150}
                      height={isCatchPhrase ? 120 : isLarge ? 190 : 90}
                      className={cn(
                        "w-full h-full object-contain",
                        isLight && !isCatchPhrase && "brightness-0 opacity-80",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className={cn(
              "flex justify-center items-center text-base",
              isLight ? "text-black/50" : "text-slate-300",
            )}
          >
            <span className="font-medium">Trusted by leading brands</span>
          </div>
        </section>

        <section
          className={cn(
            "relative overflow-hidden px-4 py-14 sm:px-5 sm:py-20 md:px-10 lg:px-20 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
          )}
        >
          <div className="mx-auto max-w-[1280px]">
            {/* ================= HEADING ================= */}
            <h2 className="mx-auto max-w-[720px] text-center text-[28px] font-semibold leading-[1.08] tracking-[-1.5px] sm:text-[36px] sm:tracking-[-2px] md:text-[54px] md:tracking-[-2.5px] lg:text-[56px]">
              The Old way of promoting
              <br />
              your brand
            </h2>

            {/* ================= MAIN CONTENT ================= */}
            <div className="relative mx-auto mt-12 max-w-[1150px] sm:mt-16 lg:mt-24 lg:h-[450px]">
              {/* =================================================
              CREATOR DEAL CARD
          ================================================= */}
              <div
                className={cn(
                  "relative z-10 mx-auto w-full max-w-[420px] rotate-[-3deg] rounded-[25px] p-5 sm:rotate-[-7deg] sm:p-6 lg:absolute lg:left-[2%] lg:top-[25px]",
                  isLight
                    ? "border-[0.69px] border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000000D]"
                    : "border border-white/[0.13] bg-[#171717] shadow-[-10px_0_65px_-10px_rgba(255,255,255,0.28),-12px_0_32px_-12px_rgba(255,255,255,0.14),-18px_14px_55px_-22px_rgba(255,140,0,0.18)]",
                )}
              >
                {/* Top labels */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px]",
                      isLight
                        ? "border border-[#0000000D] bg-white text-black/70"
                        : "border border-white/[0.20] bg-white/[0.01] text-white/65",
                    )}
                  >
                    Typical Creator Deal
                  </span>

                  <span
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px]",
                      isLight
                        ? "border border-orange-500/25 bg-orange-500/15 text-orange-500"
                        : "border border-orange-500/[0.35] bg-orange-500/[0.18] text-orange-400",
                    )}
                  >
                    Fixed Pay
                  </span>
                </div>

                {/* Creator */}
                <div className="mt-5 flex items-center gap-3">
                  <img
                    src="/images/b7df36a6062b7711918a958fcd444794e0abf80b.png"
                    alt="Creator"
                    className="h-[72px] w-[72px] rounded-md object-cover"
                  />

                  <div>
                    <p
                      className={cn(
                        "text-[15px]",
                        isLight ? "text-black/45" : "text-white/50",
                      )}
                    >
                      @sarahcreates
                    </p>

                    <p
                      className={cn(
                        "text-[18px] font-medium",
                        isLight ? "text-black" : "text-white/80",
                      )}
                    >
                      500k followers
                    </p>

                    <p
                      className={cn(
                        "mt-1 text-[14px]",
                        isLight ? "text-black/40" : "text-white/40",
                      )}
                    >
                      Life · Tech
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-7 grid grid-cols-2 gap-5">
                  <div className="flex items-start gap-3">
                    <Image
                      src="/images/Frame (1).png"
                      alt=""
                      width={24}
                      height={24}
                      className={cn(
                        "mt-1 h-6 w-6 shrink-0 object-contain",
                        isLight ? "opacity-60 brightness-0" : "opacity-40",
                      )}
                    />

                    <div>
                      <p
                        className={cn(
                          "text-[14px]",
                          isLight ? "text-black/40" : "text-white/40",
                        )}
                      >
                        Content
                      </p>

                      <p
                        className={cn(
                          "mt-1 text-[15px]",
                          isLight ? "text-black" : "text-white/80",
                        )}
                      >
                        1 Instagram Reel
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CalendarDays
                      size={24}
                      strokeWidth={1.5}
                      className={cn(
                        "mt-1",
                        isLight ? "text-black/40" : "text-white/40",
                      )}
                    />

                    <div>
                      <p
                        className={cn(
                          "text-[14px]",
                          isLight ? "text-black/40" : "text-white/40",
                        )}
                      >
                        Timeline
                      </p>

                      <p
                        className={cn(
                          "mt-1 text-[15px]",
                          isLight ? "text-black" : "text-white/80",
                        )}
                      >
                        1 week
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div
                  className={cn(
                    "mt-6 flex items-center justify-between rounded-lg px-4 py-4",
                    isLight ? "bg-[#F1F1F1]" : "bg-[#202020]",
                  )}
                >
                  <span
                    className={cn(
                      "text-[14px]",
                      isLight ? "text-black/45" : "text-white/40",
                    )}
                  >
                    Creators Fee
                  </span>

                  <span
                    className={cn(
                      "text-[17px] font-medium",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    $4,000
                  </span>
                </div>
              </div>

              {/* =================================================
              DOTTED CONNECTOR
          ================================================= */}
              <div
                className={cn(
                  "absolute left-[44%] top-[175px] z-0 hidden w-[205px] border-t border-dotted lg:block",
                  isLight ? "border-black/25" : "border-white/30",
                )}
              />

              {/* =================================================
              HANDWRITTEN TEXT
          ================================================= */}
              <p
                className={cn(
                  "relative mx-auto mt-12 w-fit -rotate-[2deg] text-center text-[18px] font-medium italic sm:mt-20 sm:text-[22px] lg:absolute lg:right-[7%] lg:top-[0px] lg:mt-0 lg:text-left",
                  isLight ? "text-black/60" : "text-white/75",
                )}
                style={{
                  fontFamily: "cursive",
                }}
              >
                What you are paying for
              </p>

              {/* =================================================
              RIGHT SIDE CARDS
          ================================================= */}
              <div
                className="
              relative mx-auto
              mt-10
              w-full max-w-[390px]

              lg:absolute
              lg:right-[1%]
              lg:top-[90px]
              lg:mt-0
            "
              >
                {comparisonItems.map((item, index) => {
                  const Icon = "icon" in item ? item.icon : null;

                  return (
                    <div
                      key={item.text}
                      className={cn(
                        "relative flex h-[58px] items-center justify-between rounded-full px-5 transition-transform duration-300 hover:translate-x-1",
                        item.rotate,
                        index !== 0 && "mt-[15px]",
                        isLight
                          ? "border-[0.69px] border-[#0000000D] bg-[#ECECEC] shadow-[0_13.12px_26.25px_0_#9A9A9A1A]"
                          : "border border-white/[0.14] bg-[#18181a] shadow-[0_8px_22px_rgba(255,255,255,0.055),0_12px_25px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]",
                      )}
                    >
                      {/* Left content */}
                      <div
                        className={cn(
                          "flex items-center gap-3",
                          isLight ? "text-black/60" : "text-white/55",
                        )}
                      >
                        {"image" in item && item.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            width={25}
                            height={25}
                            className={cn(
                              "h-[25px] w-[25px] shrink-0 object-contain",
                              isLight
                                ? "opacity-70 brightness-0"
                                : "opacity-55",
                            )}
                          />
                        ) : Icon ? (
                          <Icon
                            size={25}
                            strokeWidth={1.5}
                            className="shrink-0"
                          />
                        ) : null}

                        <span className="text-[16px]">{item.text}</span>
                      </div>

                      {/* Status */}
                      {item.status === "success" ? (
                        <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#4ade52] text-black">
                          <Check size={13} strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff4141] text-black">
                          <X size={13} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  );
                })}
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
          className={cn(
            "relative py-14 sm:py-20 md:py-28 transition-colors duration-300",
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
                  "text-[28px] font-bold leading-tight sm:text-3xl md:text-5xl lg:text-6xl",
                  isLight ? "text-black" : "text-white",
                )}
              >
                The New way with
                <br />
                just three simple steps
              </h2>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* Card 1 */}
              <div
                className={cn(
                  "relative min-h-[460px] overflow-hidden rounded-[20px] sm:min-h-[515px]",
                  isLight
                    ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                    : "border border-white/10 bg-gradient-to-br from-[#252525] to-[#171717]",
                )}
              >
                {/* =========================
    BACKGROUND DETAILS FORM
========================== */}
                <div
                  className={cn(
                    "absolute inset-0",
                    isLight ? "" : "opacity-[0.6] blur-[0.2px]",
                  )}
                >
                  <div
                    className={cn(
                      "h-full",
                      isLight ? "bg-[#ECECEC]" : "bg-[#17181d]",
                    )}
                  >
                    {/* Details */}
                    <div className="px-3 pt-16">
                      <div className="mb-5 flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full text-[8px]",
                            isLight
                              ? "bg-[#7C3AED]/15 text-[#7C3AED]"
                              : "bg-white/10 text-white",
                          )}
                        >
                          1
                        </div>

                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            isLight ? "text-black/80" : "text-white",
                          )}
                        >
                          Details
                        </span>
                      </div>

                      {/* Campaign Title */}
                      <div className="mb-3">
                        <label
                          className={cn(
                            "mb-1 block text-[7px]",
                            isLight ? "text-black/70" : "text-white",
                          )}
                        >
                          Campaign title <span className="text-red-400">*</span>
                        </label>

                        <div
                          className={cn(
                            "h-[22px] px-2 py-1 text-[7px]",
                            isLight
                              ? "rounded-sm border border-[#0000000D] bg-white text-black/45"
                              : "bg-white/[0.07] text-gray-400",
                          )}
                        >
                          e.g. Create a Viral shorts/video for our New App
                        </div>
                      </div>

                      {/* Platform + Content */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            className={cn(
                              "mb-1 block text-[7px]",
                              isLight ? "text-black/70" : "text-white",
                            )}
                          >
                            Platform <span className="text-red-400">*</span>
                          </label>

                          <div
                            className={cn(
                              "flex h-[23px] items-center justify-between px-2 text-[7px]",
                              isLight
                                ? "rounded-sm border border-[#0000000D] bg-white text-black/60"
                                : "bg-white/[0.07] text-gray-300",
                            )}
                          >
                            <span>◉ YouTube</span>
                            <span>⌄</span>
                          </div>
                        </div>

                        <div>
                          <label
                            className={cn(
                              "mb-1 block text-[7px]",
                              isLight ? "text-black/70" : "text-white",
                            )}
                          >
                            Content Type (optional)
                          </label>

                          <div
                            className={cn(
                              "flex h-[23px] items-center px-2 text-[7px]",
                              isLight
                                ? "rounded-sm border border-[#0000000D] bg-white text-black/45"
                                : "bg-white/[0.07] text-gray-400",
                            )}
                          >
                            Select content type
                          </div>
                        </div>
                      </div>

                      {/* Thumbnail */}
                      <div className="mt-3">
                        <label
                          className={cn(
                            "mb-1 block text-[7px]",
                            isLight ? "text-black/70" : "text-white",
                          )}
                        >
                          Thumbnail
                        </label>

                        <div
                          className={cn(
                            "flex h-[56px] flex-col items-center justify-center",
                            isLight
                              ? "rounded-sm border border-dashed border-[#0000001A] bg-white"
                              : "bg-white/[0.06]",
                          )}
                        >
                          <Upload
                            size={10}
                            className={cn(
                              "mb-2",
                              isLight ? "text-black/45" : "text-gray-400",
                            )}
                          />

                          <p
                            className={cn(
                              "text-[7px]",
                              isLight ? "text-black/60" : "text-gray-300",
                            )}
                          >
                            Drag, drop or{" "}
                            <span
                              className={cn(
                                "underline",
                                isLight ? "text-[#7C3AED]" : "",
                              )}
                            >
                              browse thumbnail
                            </span>
                          </p>

                          <p
                            className={cn(
                              "mt-1 text-[6px]",
                              isLight ? "text-black/40" : "text-gray-500",
                            )}
                          >
                            Max file size: 5MB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================
    SHADE / OVERLAY
========================== */}

                {isLight ? (
                  <>
                    {/* Soft frosted shade over details */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#ECECEC]/35 via-[#ECECEC]/55 to-[#ECECEC]" />
                    {/* Soft white haze behind budget / top area */}
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
    BUDGET CARD
========================== */}

                <div
                  className={cn(
                    "absolute right-7 top-6 z-10",
                    isLight ? "opacity-100" : "opacity-[0.85] blur-[0.2px]",
                  )}
                >
                  {/* Purple glow */}
                  <div
                    className={cn(
                      "absolute -inset-[2px] rounded-[14px] blur-md",
                      isLight &&
                        "bg-[radial-gradient(circle,rgba(124,58,237,0.18),transparent_70%)]",
                    )}
                  />

                  {/* Budget Card */}
                  <div
                    className={cn(
                      "relative w-[170px] rounded-xl border p-3 backdrop-blur-xl",
                      isLight
                        ? "border-[#0000000D] bg-[#ECECEC]"
                        : "border-purple-400/25 border-r-purple-400/60 border-t-purple-400/40 bg-[#16161b]/55 shadow-[8px_0_18px_rgba(124,58,237,0.18)]",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-2 flex items-center gap-2 text-xs font-medium",
                        isLight ? "text-black/60" : "text-gray-300",
                      )}
                    >
                      <WalletCards size={14} />
                      Budget
                    </div>

                    <div
                      className={cn(
                        "rounded-md px-3 py-2 text-sm font-semibold backdrop-blur-md",
                        isLight
                          ? "border border-[#0000000D] bg-white text-black/70"
                          : "bg-black/25 text-gray-400",
                      )}
                    >
                      $ 24000
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

                <div className="absolute inset-x-0 top-[260px] z-20 px-4 sm:left-5 sm:right-5 sm:top-[300px] sm:px-0">
                  <div
                    className={cn(
                      "flex items-center rounded-full p-1 backdrop-blur-lg",
                      isLight
                        ? "border border-black/[0.06] bg-white shadow-[0_10px_30px_rgba(20,16,40,0.12)]"
                        : "border border-white/10 bg-[#2a2a2a]/90",
                    )}
                  >
                    <button className="rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-2.5 py-1.5 text-xs text-white shadow-[0_4px_18px_rgba(124,58,237,0.55)] sm:px-3 sm:text-sm">
                      CPM
                    </button>

                    <button
                      className={cn(
                        "flex-1 text-xs sm:text-sm",
                        isLight ? "text-black/55" : "text-gray-400",
                      )}
                    >
                      Leaderboard
                    </button>

                    <button
                      className={cn(
                        "flex-1 text-xs sm:text-sm",
                        isLight ? "text-black/55" : "text-gray-400",
                      )}
                    >
                      Milestone
                    </button>

                    <button
                      className={cn(
                        "flex-1 text-xs sm:text-sm",
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
                      "mb-3 text-xl font-semibold",
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
                    : "border border-white/10 bg-[#1b1b1b]",
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
                    isLight ? "bg-[#ECECEC]/70" : "bg-[#1b1b1b]/80",
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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-4 py-2 text-sm font-medium text-white shadow-lg">
                    {isLight ? <Megaphone size={14} /> : null}
                    Publish
                  </span>
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
                  "relative min-h-[515px] overflow-hidden rounded-[20px]",
                  isLight
                    ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                    : "border border-white/10 bg-gradient-to-br from-[#252525] to-[#171717]",
                )}
              >
                {/* Rewards panel */}
                <div
                  className={cn(
                    "absolute left-5 right-5 top-16 rounded-2xl p-5",
                    isLight
                      ? "border border-black/[0.06] bg-[#DEDEDE] shadow-[0px_11px_21.99px_0px_#FFFFFF5C]"
                      : "border border-white/5 bg-[#202020]/90",
                  )}
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
                      "mt-5 text-center text-[9px]",
                      isLight ? "text-black/40" : "text-gray-500",
                    )}
                  >
                    ▮▮ All payments are based on verified performance
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
              "relative z-10 mx-auto flex h-[340px] w-full max-w-[730px] items-start justify-center overflow-hidden rounded-[16px] px-3 pt-6 sm:h-[400px] sm:w-[90%] sm:rounded-[18px] sm:px-4 sm:pt-10 md:h-[430px] md:pt-12",
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
                "relative z-10 w-full max-w-[485px] rounded-[16px] px-4 py-6 sm:rounded-[18px] sm:px-9 sm:py-9",
                isLight
                  ? "bg-[#F8F8F8] shadow-[0_10.18px_20.36px_0_#6C6C6C1A] border border-[#0000000D]"
                  : "border border-[#353535] bg-[#171717] shadow-[8px_8px_50px_0px_#00000080] sm:shadow-[4px_12px_4px_0px_#0000001A]",
              )}
            >
              {/* Header */}
              <div className="mb-5 flex items-start justify-between gap-3 sm:mb-7">
                <div className="min-w-0">
                  <h2
                    className={cn(
                      "text-lg font-medium sm:text-xl",
                      isLight ? "text-black" : "text-[#d8d8df]",
                    )}
                  >
                    Creator Submissions
                  </h2>

                  <p
                    className={cn(
                      "mt-1 text-xs sm:text-sm",
                      isLight ? "text-black/45" : "text-[#92929a]",
                    )}
                  >
                    Payment are done after brand approves
                  </p>
                </div>

                <p
                  className={cn(
                    "shrink-0 pt-1 text-lg font-medium sm:text-xl",
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
                      "flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4",
                      index !== submissions.length - 1 &&
                        (isLight
                          ? "border-b border-black/[0.06]"
                          : "border-b border-white/[0.04]"),
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 shrink-0 overflow-hidden rounded-full sm:h-11 sm:w-11",
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
                            "truncate text-[14px] font-medium sm:text-[16px]",
                            isLight ? "text-black" : "text-[#dedee3]",
                          )}
                        >
                          {submission.name}
                        </h3>

                        <p
                          className={cn(
                            "mt-0.5 text-xs sm:text-sm",
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
                          "rounded-full px-3 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm",
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
                          "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm",
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
                "relative mb-10 text-center text-3xl font-bold tracking-tight sm:mb-16 sm:text-4xl md:text-5xl",
                isLight ? "text-black" : "text-white",
              )}
            >
              Everything that you need
            </h2>

            {/* TOP TWO CARDS */}
            <div className="relative grid gap-5 lg:grid-cols-2">
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
                  <div className="animate-engagement-profiles-scroll absolute left-1/2 top-0 flex w-[230px] flex-col gap-2.5 will-change-transform">
                    {[...profiles, ...profiles].map((profile, index) => (
                      <div
                        key={`${profile.name}-${profile.status}-${index}`}
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
                              isLight
                                ? "text-black/40"
                                : profile.type === "bad"
                                  ? "text-white/20"
                                  : "text-white/25",
                            )}
                          >
                            {profile.status}
                          </div>
                        </div>

                        <div
                          className={`flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full ${
                            profile.type === "bad"
                              ? "bg-[#d92d25]"
                              : "bg-[#26a844]"
                          }`}
                        >
                          {profile.type === "bad" ? (
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
                          ) : (
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
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fade over profiles */}
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-[70px] z-[2] h-[220px] bg-gradient-to-b from-transparent",
                    isLight
                      ? "via-[#ECECEC]/40 to-[#ECECEC]"
                      : "via-[#171717]/35 to-[#171717]",
                  )}
                />

                {/* Pinched purple curve */}
                <div className="pointer-events-none absolute inset-x-0 top-[92px] z-[4] h-[150px] overflow-hidden">
                  {/* Soft purple glow — clipped so blur can't inflate curve height */}
                  <div
                    className={cn(
                      "absolute inset-x-0 top-1/2 h-[70%] -translate-y-1/2 blur-[14px]",
                      isLight ? "opacity-80" : "opacity-55",
                    )}
                    aria-hidden
                  >
                    <svg
                      viewBox="0 0 1000 200"
                      preserveAspectRatio="none"
                      className="h-full w-full"
                    >
                      <path
                        d="M0 10 C220 95, 780 95, 1000 10 L1000 190 C780 105, 220 105, 0 190 Z"
                        fill="#754FF6"
                      />
                    </svg>
                  </div>

                  <svg
                    viewBox="0 0 1000 200"
                    preserveAspectRatio="none"
                    className="relative h-full w-full"
                  >
                    <defs>
                      <radialGradient
                        id="engagementPurple"
                        cx="50%"
                        cy="51.5%"
                        r="50%"
                        fx="50%"
                        fy="51.5%"
                        gradientUnits="objectBoundingBox"
                        gradientTransform="translate(0.5 0.515) scale(1 0.97) translate(-0.5 -0.515)"
                      >
                        <stop offset="0%" stopColor="#754FF6" />
                        <stop offset="100%" stopColor="#442E90" />
                      </radialGradient>
                      <filter
                        id="engagementNoise"
                        x="0%"
                        y="0%"
                        width="100%"
                        height="100%"
                        filterUnits="objectBoundingBox"
                      >
                        <feTurbulence
                          type="fractalNoise"
                          baseFrequency="0.9"
                          numOctaves="2"
                          stitchTiles="stitch"
                          result="noise"
                        />
                        <feColorMatrix
                          in="noise"
                          type="saturate"
                          values="0"
                          result="desat"
                        />
                        <feBlend
                          in="SourceGraphic"
                          in2="desat"
                          mode="overlay"
                        />
                      </filter>
                      <clipPath id="engagementCurveClip" clipPathUnits="userSpaceOnUse">
                        <path d="M0 8 C240 98, 760 98, 1000 8 L1000 192 C760 102, 240 102, 0 192 Z" />
                      </clipPath>
                    </defs>
                    <path
                      d="M0 8 C240 98, 760 98, 1000 8 L1000 192 C760 102, 240 102, 0 192 Z"
                      fill="url(#engagementPurple)"
                    />
                    {/* Grain clipped to the curve — no white fringe outside the path */}
                    <g clipPath="url(#engagementCurveClip)">
                      <path
                        d="M0 8 C240 98, 760 98, 1000 8 L1000 192 C760 102, 240 102, 0 192 Z"
                        fill="#754FF6"
                        opacity="0.35"
                        filter="url(#engagementNoise)"
                      />
                    </g>
                  </svg>

                  <div className="absolute inset-0 flex items-center justify-center gap-2 px-4 sm:gap-2.5">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="hidden shrink-0 sm:block"
                    >
                      <path
                        d="M4 11.5L13.5 9L15.5 15L6 17.5L4 11.5Z"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13.5 9L15.2 5.8L19.2 7.1L17.8 10.2"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 16.5L10.5 21"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7.5 21H13"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M18.5 2.5V5.5M17 4H20"
                        stroke="white"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-center text-[12px] font-medium tracking-[-0.02em] text-white sm:text-[15px]">
                      Authentic Data. Verified Performance
                    </span>
                  </div>
                </div>

                {/* Bottom text */}
                <div className="absolute bottom-5 left-4 right-4 z-10 sm:bottom-7 sm:left-7 sm:right-7">
                  <h3
                    className={cn(
                      "mb-2 text-lg font-semibold sm:text-xl",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Real Engagement Only
                  </h3>
                  <p
                    className={cn(
                      "max-w-[480px] text-[13px] leading-5 sm:text-[15px] sm:leading-6",
                      isLight ? "text-black/50" : "text-white/50",
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
                      {/* Rings — hard clip at hub midline */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 overflow-hidden">
                        <div className="absolute left-1/2 top-[170px] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2">
                          <div
                            className={cn(
                              "absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border",
                              isLight
                                ? "border-black/20"
                                : "border-[0.43px] border-[#2D2D2D] shadow-[0px_2px_0px_0px_#000000]",
                            )}
                          />
                          <div
                            className={cn(
                              "absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border",
                              isLight
                                ? "border-black/20"
                                : "border-[0.43px] border-[#2D2D2D] shadow-[0px_2px_0px_0px_#000000]",
                            )}
                          />
                        </div>
                      </div>

                      {/* Badges — padded clip so full badge shows on the upper arc;
                          still hides once they rotate into the bottom half */}
                      <div className="absolute -inset-x-7 -top-7 z-20 h-[calc(50%+28px+28px)] overflow-hidden">
                        <div className="absolute left-1/2 top-[calc(170px+28px)] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2">
                          {/* Outer ring — Instagram + YouTube (opposite) */}
                          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2">
                            <div className="absolute inset-0 animate-source-orbit-outer">
                              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-14 w-14 animate-source-orbit-outer-counter items-center justify-center rounded-full",
                                    isLight ? "bg-[#DEDEDE]" : "bg-[#2b2b2b]",
                                  )}
                                >
                                  <SiInstagram className="h-6 w-6 text-[#E1306C]" />
                                </div>
                              </div>
                              <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-14 w-14 animate-source-orbit-outer-counter items-center justify-center rounded-full",
                                    isLight ? "bg-[#DEDEDE]" : "bg-[#2b2b2b]",
                                  )}
                                >
                                  <SiYoutube className="h-6 w-6 text-[#FF0000]" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Inner ring — TikTok + X (opposite, 90° from outer) */}
                          <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2">
                            <div className="absolute inset-0 animate-source-orbit-inner">
                              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-14 w-14 animate-source-orbit-inner-counter items-center justify-center rounded-full",
                                    isLight ? "bg-[#DEDEDE]" : "bg-[#2b2b2b]",
                                  )}
                                >
                                  <SiTiktok
                                    className={cn(
                                      "h-6 w-6",
                                      isLight ? "text-black" : "text-white",
                                    )}
                                  />
                                </div>
                              </div>
                              <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2">
                                <div
                                  className={cn(
                                    "flex h-14 w-14 animate-source-orbit-inner-counter items-center justify-center rounded-full",
                                    isLight ? "bg-[#DEDEDE]" : "bg-[#2b2b2b]",
                                  )}
                                >
                                  <FaXTwitter
                                    className={cn(
                                      "h-5 w-5",
                                      isLight ? "text-black" : "text-white",
                                    )}
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
                          "absolute left-1/2 top-[40%] z-30 flex h-[80px] w-[80px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                          isLight
                            ? "bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                            : "bg-[#1c1c1c] shadow-[0_22px_40px_rgba(109,70,255,0.55)]",
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
                <div className="absolute bottom-5 left-4 right-4 z-10 sm:bottom-7 sm:left-7 sm:right-7">
                  <h3
                    className={cn(
                      "mb-2 text-lg font-semibold sm:text-xl",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Connected at the source
                  </h3>

                  <p
                    className={cn(
                      "max-w-[480px] text-[13px] leading-5 sm:text-[15px] sm:leading-6",
                      isLight ? "text-black/50" : "text-white/50",
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
                "relative mt-6 w-full overflow-hidden rounded-[16px] px-4 py-6 sm:rounded-[20px] sm:px-6 sm:py-8 lg:px-9 lg:py-9",
                isLight
                  ? "bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                  : "border border-white/10 bg-[#151515]",
              )}
            >
              <div className="relative flex flex-col xl:min-h-[390px] xl:flex-row">
                {/* LEFT CONTENT */}
                <div className="relative z-30 w-full shrink-0 xl:w-[310px]">
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
                      "mt-2 max-w-[280px] text-[14px] leading-[22px] sm:max-w-[250px] sm:text-[16px] sm:leading-[24px]",
                      isLight ? "text-black/50" : "text-white/50",
                    )}
                  >
                    Chose the format that fit your goals -
                    <br className="hidden sm:block" />
                    from guaranteed reach to
                    <br className="hidden sm:block" />
                    performance-based rewards
                  </p>
                </div>

                {/* CARDS AREA — horizontal scroll on small screens, fan on xl */}
                <div className="relative -mx-4 mt-6 overflow-x-auto pb-2 xl:absolute xl:left-[280px] xl:top-[-8px] xl:mx-0 xl:mt-0 xl:h-[460px] xl:w-[calc(100%-240px)] xl:overflow-visible xl:pb-0 2xl:left-[300px]">
                  <div className="relative h-[400px] w-[780px] sm:h-[430px] sm:w-[860px] xl:h-[460px] xl:w-full">
                    {/* ================= CPM CARD ================= */}
                    <div
                      className="
              absolute left-0 top-[18px] z-[10]
              h-[380px] w-[240px]
              overflow-hidden rounded-[22px]
              bg-gradient-to-br from-[#7445ef] to-[#5c36d8]
              shadow-2xl
              sm:h-[410px] sm:w-[270px]
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
                              <path d="M10 6.5L1 1V12L10 6.5Z" fill="#7B4CF2" />
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
              absolute left-[160px] top-[28px] z-[20]
              h-[380px] w-[240px]
              overflow-hidden rounded-[22px]
              bg-gradient-to-br from-[#ffc743] to-[#d69a28]
              shadow-2xl
              sm:left-[190px] sm:h-[410px] sm:w-[270px]
            "
                      style={{ transform: "rotate(2.5deg)" }}
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
                                    className="h-full rounded-full bg-[#ff941d]"
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
              absolute left-[310px] top-[42px] z-[30]
              h-[380px] w-[240px]
              overflow-hidden rounded-[22px]
              bg-gradient-to-br from-[#ed3fcd] to-[#b832bc]
              shadow-2xl
              sm:left-[360px] sm:h-[410px] sm:w-[270px]
            "
                      style={{ transform: "rotate(4deg)" }}
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
                          <div className="absolute left-[11px] top-[9px] bottom-[24px] w-[2px] bg-[#ff4fc9]" />

                          {/* 100K */}
                          <div className="relative flex gap-5">
                            <div className="relative z-10 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#ff28a8]">
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
                          <div className="relative mt-3 flex gap-5">
                            <div className="relative z-10 h-[20px] w-[20px] rounded-full border-2 border-[#ff8bd6] bg-white" />

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
                          <div className="relative mt-3 flex gap-5">
                            <div className="relative z-10 h-[20px] w-[20px] rounded-full border-2 border-[#ff8bd6] bg-white" />

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
              absolute left-[460px] top-[58px] z-[40]
              h-[360px] w-[250px]
              overflow-hidden rounded-[22px]
              bg-gradient-to-br from-[#36b4eb] to-[#2396d1]
              shadow-2xl
              sm:left-[540px] sm:top-[64px] sm:h-[380px] sm:w-[300px]
            "
                      style={{ transform: "rotate(5.5deg)" }}
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
                        <div className="relative rounded-[11px] bg-[#d9f2ff] px-4 py-4">
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
                                  fill="#069DE2"
                                />
                              </svg>
                            </div>

                            <div>
                              <div className="text-[17px] font-semibold leading-[19px] text-[#079be0]">
                                $1.00
                              </div>

                              <div className="text-[13px] leading-[16px] text-[#079be0]">
                                per 1,000 view
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Plus */}
                        <div className="relative z-10 mx-auto my-[-3px] flex h-[40px] w-[40px] items-center justify-center">
                          <div className="absolute h-[4px] w-[32px] rounded-full bg-[#55b8e9]" />
                          <div className="absolute h-[32px] w-[4px] rounded-full bg-[#55b8e9]" />
                        </div>

                        {/* Milestone reward */}
                        <div className="rounded-[11px] bg-[#d9f2ff] px-4 py-4">
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
                                stroke="#079BE0"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>

                            <div className="text-[#079be0]">
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
            "px-4 py-12 sm:px-6 sm:py-16 md:min-h-screen lg:px-20 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1] text-black" : "bg-black text-white",
          )}
        >
          <div className="mx-auto flex max-w-[1240px] items-center md:min-h-[700px]">
            <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_436px] lg:gap-16">
              {/* Left Content */}
              <div className="max-w-[650px]">
                <h2 className="text-[28px] font-semibold leading-[1.1] tracking-[-1.2px] sm:text-[42px] sm:tracking-[-1.8px] lg:text-[52px]">
                  Real campaigns. Proven
                  <br />
                  performance.
                </h2>

                <p
                  className={cn(
                    "mt-5 max-w-[640px] text-[16px] font-medium italic leading-[1.7] tracking-[-0.3px] sm:mt-8 sm:text-[20px] sm:leading-[1.8] md:text-[22px]",
                    isLight ? "text-[#757575]" : "text-[#c9c9c9]",
                  )}
                >
                  “GOC helped us move from paying for reach to understanding the
                  actual performance behind every piece of content. The
                  visibility made campaign decisions much easier.”
                </p>

                <div className="mt-7">
                  <p className="text-[15px] font-normal text-[#757575]">
                    Ranveer Allahbadia
                  </p>
                  <p className="mt-1 text-[15px] font-normal text-[#757575]">
                    Founder, BeerBiceps
                  </p>
                </div>

                {/* Stats */}
                <div
                  className={cn(
                    "mt-12 flex w-full max-w-[545px] overflow-hidden rounded-[16px] px-8 py-4",
                    isLight
                      ? "bg-[#ECECEC] shadow-[0px_1px_0px_0px_#FFFFFF54] border border-black/[0.06]"
                      : "bg-[#252525]",
                  )}
                >
                  <div className="flex-1">
                    <p className="text-[32px] font-medium leading-none text-[#7F39EC]">
                      3+
                    </p>
                    <p className="mt-2 text-[14px] text-[#858585]">
                      Campaigns Launched
                    </p>
                  </div>

                  <div className="flex-1">
                    <p className="text-[32px] font-medium leading-none text-[#7F39EC]">
                      2.5M+
                    </p>
                    <p className="mt-2 text-[14px] text-[#858585]">
                      Views generated
                    </p>
                  </div>

                  <div className="flex-1">
                    <p className="text-[32px] font-medium leading-none text-[#7F39EC]">
                      16%
                    </p>
                    <p className="mt-2 text-[14px] text-[#858585]">
                      Engagement Rate
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Video / Image */}
              <div className="relative mx-auto h-[420px] w-full max-w-[436px] overflow-hidden rounded-[28px] sm:h-[560px] sm:rounded-[40px] md:h-[660px] md:rounded-[48px]">
                <Image
                  src="/images/ee0bbe0b8188b7baabb964e4fc87a704b2fbcdf8.png"
                  alt="Campaign testimonial"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 436px"
                />
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
            <div className="pointer-events-none absolute inset-x-0 top-[280px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.10),transparent_65%)] sm:top-[360px] sm:h-[600px]" />
          )}

          {/* Top content */}
          <div className="relative z-20 mx-auto max-w-3xl text-center">
            <h2
              className={cn(
                "text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-4xl md:text-5xl md:text-[52px]",
                isLight ? "text-black" : "text-white",
              )}
            >
              The results gets sharper
              <br />
              with every campaign.
            </h2>

            <p
              className={cn(
                "mx-auto mt-4 max-w-[620px] text-sm leading-6 sm:mt-5 sm:text-base",
                isLight ? "text-black/50" : "text-neutral-500",
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
                "mt-6 inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70",
                isLight
                  ? "bg-black text-white hover:bg-black/90 shadow-[0_10px_30px_rgba(15,15,30,0.12)]"
                  : "border border-white/20 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.4)] hover:bg-white/10",
              )}
            >
              {isLaunchingCampaign ? <ButtonLoadingSpinner /> : null}
              <span>Launch a Campaign</span>
              <span className="text-lg">→</span>
            </button>
          </div>

          {/* Map */}
          <div className="relative mx-auto mt-8 h-[320px] w-full max-w-[1250px] sm:mt-12 sm:h-[420px] md:h-[520px] lg:h-[580px]">
            {isLight ? (
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[70%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.35)_0%,transparent_68%)] blur-3xl"
              />
            ) : null}
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
                  stroke={isLight ? "#7c3aed" : "white"}
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
                  "absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-center text-[10px] font-medium shadow-lg sm:mt-2 sm:px-5 sm:py-2 sm:text-sm",
                  isLight
                    ? "border border-black/10 bg-white text-black"
                    : "border border-black/30 bg-white/80 text-black backdrop-blur",
                )}
              >
                Campaign Launched
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
                    "mt-0.5 hidden whitespace-nowrap text-sm font-medium sm:mt-1 sm:block",
                    isLight ? "text-black/70" : "text-white",
                  )}
                >
                  {person.name}
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
          <DialogContent className="bg-[#050816] border border-violet-500/30 text-white rounded-2xl shadow-2xl shadow-violet-900/40 sm:max-w-xl p-8">
            <DialogHeader>
              <DialogTitle className="text-xl mb-4 lg:text-2xl leading-tight font-semibold">
                You&apos;re logged in as{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  a creator
                </span>
              </DialogTitle>
              <DialogDescription className="text-base text-slate-300 leading-relaxed">
                To continue as a brand, please sign out from your creator
                account first, then sign up or log in as a brand.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                className="inline-flex w-full items-center justify-center gap-2 border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5 sm:w-auto"
                onClick={handleContinueAsCreator}
                disabled={isSigningOut || isLaunchingCampaign}
              >
                {isLaunchingCampaign ? <ButtonLoadingSpinner /> : null}
                <span>Continue as Creator</span>
              </Button>
              <Button
                className="inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white hover:from-[#5a2ba3] hover:to-[#8f45f5] px-6 py-5 sm:w-auto"
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
