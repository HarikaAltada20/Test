"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  UserRound,
  CalendarDays,
  Check,
  Grid3X3,
  LineChart,
  Upload,
  UsersRound,
  X,
  WalletCards,
  ArrowUpRight,
} from "lucide-react";
import CtcBanner from "@/components/CtcBanner";
import NumbersSection from "@/components/NumberSection";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
// Placeholder for social icons image - reuse from creators page
import SocialPair from "@/public/images/social_pair.avif";
import BrandGetStartedButton from "@/components/BrandGetStartedButton";

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
    icon: Grid3X3,
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
    image: "",
    status: "Approved",
    approved: true,
  },
  {
    name: "Kevin Bai",
    subtitle: "Waiting...",
    image: "",
    status: "Under Review",
    approved: false,
  },
  {
    name: "Shaan Patel",
    subtitle: "Waiting...",
    image: "",
    status: "Under Review",
    approved: false,
  },
  {
    name: "Jimmy Deng",
    subtitle: "Waiting...",
    image: "",
    status: "Under Review",
    approved: false,
  },
];

export default function BrandsClient({ totalViews }: BrandsClientProps) {
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
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="relative z-20">
        {/* Floating Gaming Elements */}
        <main className="min-h-screen overflow-hidden bg-[#030303] text-white">
          {/* Background */}
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute left-1/2 top-[320px] h-[850px] w-[850px] -translate-x-1/2 rounded-full bg-[#3d246e]/20 blur-[180px]" />
            <div className="absolute bottom-[-300px] left-1/2 h-[700px] w-[900px] -translate-x-1/2 bg-[#292052]/40 blur-[180px]" />
          </div>

          {/* Hero */}
          <section className="relative mx-auto max-w-[1080px] px-6 pt-14 text-center md:pt-16">
            {/* Circular rings */}
            <div className="pointer-events-none absolute left-1/2 top-[-80px] h-[650px] w-[650px] -translate-x-1/2 rounded-full border border-white/[0.035]" />

            <div className="pointer-events-none absolute left-1/2 top-[-40px] h-[570px] w-[570px] -translate-x-1/2 rounded-full border border-white/[0.035]">
              <div className="absolute -left-[2px] top-[100px] h-[3px] w-[145px] -rotate-[61deg] rounded-full bg-gradient-to-r from-transparent via-[#ff8800] to-[#ff8800]" />

              <div className="absolute -right-[2px] top-[110px] h-[3px] w-[130px] rotate-[62deg] rounded-full bg-gradient-to-r from-[#7f39ec] to-transparent" />
            </div>

            <div className="relative z-10">
              <h1 className="mx-auto max-w-[700px] text-[38px] font-bold leading-[1.08] tracking-[-1.8px] text-white/90 md:text-[48px]">
                Pay creators based on
                <br />
                how their content performs.
              </h1>

              <p className="mx-auto mt-5 max-w-[640px] text-[15px] leading-6 text-white/50 md:text-[16px]">
                Set your campaign, your brief, and your budget. Game of Creators
                puts it in front of a creator network, and pays out on verified
                performance
              </p>

              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button className="group flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/50 px-5 py-3 text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.03)] transition hover:bg-white/10">
                  Launch a Campaign
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
                  className="group flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
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
          <section className="relative z-20 mx-auto mt-[105px] max-w-[890px] px-5">
            <div className="rounded-[30px] border-[9px] border-[#252525] bg-[#171717] p-2 shadow-[0_30px_100px_rgba(88,54,150,0.25)]">
              {/* Main dashboard card */}
              <div className="relative min-h-[390px] overflow-hidden rounded-[22px] border border-white/[0.04] bg-[#151515]">
                {/* Fake dashboard behind */}
                <div className="absolute inset-0 opacity-[0.18]">
                  <div className="grid grid-cols-4 gap-3 p-5">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="h-20 rounded-xl border border-white/10 bg-white/[0.02]"
                      />
                    ))}
                  </div>

                  <div className="mx-5 h-48 rounded-xl border border-white/10 bg-white/[0.015]" />
                </div>

                {/* Purple glow */}
                <div className="absolute bottom-[-160px] right-[-100px] h-[400px] w-[650px] rounded-full bg-[#8869ff]/55 blur-[100px]" />

                {/* Content */}
                <div className="relative z-10 flex min-h-[390px] flex-col justify-center px-8 py-12 md:px-10">
                  <h2 className="max-w-[510px] text-[28px] font-bold leading-[1.1] tracking-[-1px] md:text-[31px]">
                    Don’t just run campaigns.
                    <br />
                    Know which creators perform
                  </h2>

                  <p className="mt-4 max-w-[390px] text-[14px] leading-6 text-white/45">
                    Know which creators, content, and moments are actually
                    driving results.
                  </p>

                  <button className="mt-5 flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-semibold text-black transition hover:bg-white/90">
                    Launch a Campaign
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Feature cards */}
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-[22px] bg-[#151515] p-7 md:grid-cols-3">
                {features.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div key={feature.title}>
                      <div className="mb-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80">
                        <Icon size={15} strokeWidth={1.8} />
                      </div>

                      <h3 className="text-[15px] font-semibold text-white/90">
                        {feature.title}
                      </h3>

                      <p className="mt-2 max-w-[230px] text-[13px] leading-5 text-white/40">
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
        <section className="pb-12 overflow-hidden bg-black">
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
                      className="w-full h-full object-contain"
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-center items-center text-base text-slate-300 ">
            <span className="font-medium">Trusted by leading brands</span>
          </div>
        </section>

        <section className="relative min-h-screen overflow-hidden bg-black px-5 py-20 text-white md:px-10 lg:px-20">
          <div className="mx-auto max-w-[1280px]">
            {/* ================= HEADING ================= */}
            <h2 className="mx-auto max-w-[720px] text-center text-[42px] font-semibold leading-[1.02] tracking-[-2.5px] md:text-[54px] lg:text-[56px]">
              The Old way of promoting
              <br />
              your brand
            </h2>

            {/* ================= MAIN CONTENT ================= */}
            <div className="relative mx-auto mt-24 max-w-[1150px] lg:h-[450px]">
              {/* =================================================
              CREATOR DEAL CARD
          ================================================= */}
              <div
                className="
              relative z-10 mx-auto
              w-full max-w-[420px]
              rotate-[-7deg]
              rounded-[25px]
              border border-white/[0.13]
              bg-[#171717]
              p-6

              shadow-[-10px_0_65px_-10px_rgba(255,255,255,0.28),-12px_0_32px_-12px_rgba(255,255,255,0.14),-18px_14px_55px_-22px_rgba(255,140,0,0.18)]

              lg:absolute
              lg:left-[2%]
              lg:top-[25px]
            "
              >
                {/* Top labels */}
                <div className="flex items-center justify-between">
                  <span
                    className="
                  rounded-full
                  border border-white/[0.20]
                  bg-white/[0.01]
                  px-3 py-1.5
                  text-[12px]
                  text-white/65
                "
                  >
                    Typical Creator Deal
                  </span>

                  <span
                    className="
                  rounded-full
                  border border-orange-500/[0.35]
                  bg-orange-500/[0.18]
                  px-3 py-1.5
                  text-[12px]
                  text-orange-400
                "
                  >
                    Fixed Pay
                  </span>
                </div>

                {/* Creator */}
                <div className="mt-5 flex items-center gap-3">
                  <div
                    className="
                  relative h-[72px] w-[72px]
                  shrink-0 overflow-hidden
                  rounded-xl
                  bg-gradient-to-br
                  from-orange-400
                  via-red-500
                  to-yellow-300
                "
                  >
                    <div className="absolute left-[18px] top-[8px] h-[52px] w-[31px] rounded-[50%] bg-black/30 blur-[7px]" />

                    <div className="absolute bottom-[-12px] right-[-3px] h-[55px] w-[48px] rounded-full bg-white/30 blur-[9px]" />
                  </div>

                  <div>
                    <p className="text-[15px] text-white/50">@sarahcreates</p>

                    <p className="text-[18px] font-medium text-white/80">
                      500k followers
                    </p>

                    <p className="mt-1 text-[14px] text-white/40">
                      Life · Tech
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-7 grid grid-cols-2 gap-5">
                  <div className="flex items-start gap-3">
                    <Grid3X3
                      size={24}
                      strokeWidth={1.5}
                      className="mt-1 text-white/40"
                    />

                    <div>
                      <p className="text-[14px] text-white/40">Content</p>

                      <p className="mt-1 text-[15px] text-white/80">
                        1 Instagram Reel
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CalendarDays
                      size={24}
                      strokeWidth={1.5}
                      className="mt-1 text-white/40"
                    />

                    <div>
                      <p className="text-[14px] text-white/40">Timeline</p>

                      <p className="mt-1 text-[15px] text-white/80">1 week</p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div
                  className="
                mt-6 flex items-center justify-between
                rounded-lg
                bg-[#202020]
                px-4 py-4
              "
                >
                  <span className="text-[14px] text-white/40">
                    Creators Fee
                  </span>

                  <span className="text-[17px] font-medium text-white">
                    $4,000
                  </span>
                </div>
              </div>

              {/* =================================================
              DOTTED CONNECTOR
          ================================================= */}
              <div
                className="
              absolute
              left-[44%]
              top-[175px]
              z-0
              hidden
              w-[205px]
              border-t
              border-dotted
              border-white/30
              lg:block
            "
              />

              {/* =================================================
              HANDWRITTEN TEXT
          ================================================= */}
              <p
                className="
              relative mx-auto mt-20 w-fit
              -rotate-[2deg]
              text-[22px]
              font-medium
              italic
              text-white/75

              lg:absolute
              lg:right-[7%]
              lg:top-[0px]
              lg:mt-0
            "
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
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.text}
                      className={`
                    relative
                    flex
                    h-[58px]
                    items-center
                    justify-between

                    rounded-full
                    border
                    border-white/[0.14]
                    bg-[#18181a]

                    px-5

                    ${item.rotate}

                    /* IMAGE-LIKE SOFT WHITE SHADOW */
                    shadow-[
                      0_8px_22px_rgba(255,255,255,0.055),
                      0_12px_25px_rgba(0,0,0,0.65),
                      inset_0_1px_0_rgba(255,255,255,0.08)
                    ]

                    /* CROSS / OVERLAP */
                    ${index !== 0 ? "mt-[15px]" : ""}

                    transition-transform
                    duration-300
                    hover:translate-x-1
                  `}
                    >
                      {/* Left content */}
                      <div className="flex items-center gap-3 text-white/55">
                        <Icon
                          size={25}
                          strokeWidth={1.5}
                          className="shrink-0"
                        />

                        <span className="text-[16px]">{item.text}</span>
                      </div>

                      {/* Status */}
                      {item.status === "success" ? (
                        <span
                          className="
                        flex h-[20px] w-[20px]
                        shrink-0
                        items-center justify-center
                        rounded-full
                        bg-[#4ade52]
                        text-black
                      "
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                      ) : (
                        <span
                          className="
                        flex h-[20px] w-[20px]
                        shrink-0
                        items-center justify-center
                        rounded-full
                        bg-[#ff4141]
                        text-black
                      "
                        >
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
        <section className="bg-[#030405] py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-5">
            {/* Heading */}
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
                The New way with
                <br />
                just three simple steps
              </h2>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* Card 1 */}
              <div className="relative min-h-[515px] overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-[#252525] to-[#171717]">
                {/* =========================
    BACKGROUND DETAILS FORM
========================== */}
                <div className="absolute inset-0  opacity-[0.6] blur-[0.2px]">
                  <div className="h-full bg-[#17181d]">
                    {/* Details */}
                    <div className="px-3 pt-16">
                      <div className="mb-5 flex items-center gap-2">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[8px] text-white">
                          1
                        </div>

                        <span className="text-[10px] text-white">Details</span>
                      </div>

                      {/* Campaign Title */}
                      <div className="mb-3">
                        <label className="mb-1 block text-[7px] text-white">
                          Campaign title <span className="text-red-400">*</span>
                        </label>

                        <div className="h-[22px] bg-white/[0.07] px-2 py-1 text-[7px] text-gray-400">
                          e.g. Create a Viral shorts/video for our New App
                        </div>
                      </div>

                      {/* Platform + Content */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[7px] text-white">
                            Platform <span className="text-red-400">*</span>
                          </label>

                          <div className="flex h-[23px] items-center justify-between bg-white/[0.07] px-2 text-[7px] text-gray-300">
                            <span>◉ YouTube</span>
                            <span>⌄</span>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[7px] text-white">
                            Content Type (optional)
                          </label>

                          <div className="flex h-[23px] items-center bg-white/[0.07] px-2 text-[7px] text-gray-400">
                            Select content type
                          </div>
                        </div>
                      </div>

                      {/* Thumbnail */}
                      <div className="mt-3">
                        <label className="mb-1 block text-[7px] text-white">
                          Thumbnail
                        </label>

                        <div className="flex h-[56px] flex-col items-center justify-center bg-white/[0.06]">
                          <Upload size={10} className="mb-2 text-gray-400" />

                          <p className="text-[7px] text-gray-300">
                            Drag, drop or{" "}
                            <span className="underline">browse thumbnail</span>
                          </p>

                          <p className="mt-1 text-[6px] text-gray-500">
                            Max file size: 5MB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================
    DARK OVERLAY
========================== */}

                <div className="absolute inset-0 bg-black/35" />

                {/* Top fade */}
                <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-black/30 via-black/20 to-transparent" />

                {/* Top-left haze */}
                <div className="pointer-events-none absolute -left-16 -top-16 h-60 w-60 rounded-full bg-[#D9D9D9]/25 blur-[90px]" />

                {/* =========================
    BUDGET CARD
========================== */}

                <div className="absolute right-7 top-6 z-10 opacity-[0.6] blur-[0.2px]">
                  {/* Purple glow */}
                  <div className="absolute -inset-[2px] rounded-[14px] blur-md" />

                  {/* Budget Card */}
                  <div
                    className="
      relative
      w-[170px]
      rounded-xl
      border
      border-purple-400/25
      border-r-purple-400/60
      border-t-purple-400/40
      bg-[#16161b]/55
      p-3
      backdrop-blur-xl
      shadow-[8px_0_18px_rgba(124,58,237,0.18)]
    "
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-300">
                      <WalletCards size={14} />
                      Budget
                    </div>

                    <div className="rounded-md bg-black/25 px-3 py-2 text-sm font-semibold text-gray-400 backdrop-blur-md">
                      $ 24000
                    </div>
                  </div>
                </div>

                {/* =========================
    BOTTOM GRADIENT
========================== */}

                <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#191919] via-[#191919]/95 to-transparent" />

                {/* =========================
    TABS
========================== */}

                <div className="absolute left-5 right-5 top-[300px] z-20">
                  <div className="flex items-center rounded-full border border-white/10 bg-[#2a2a2a]/90 p-1 backdrop-blur-lg">
                    <button className="rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-3 py-1.5 text-sm text-white shadow-[0_0_15px_rgba(124,58,237,0.6)]">
                      CPM
                    </button>

                    <button className="flex-1 text-sm text-gray-400">
                      Leaderboard
                    </button>

                    <button className="flex-1 text-sm text-gray-400">
                      Milestone
                    </button>

                    <button className="flex-1 text-sm text-gray-400">
                      Dual Rewards
                    </button>
                  </div>
                </div>

                {/* =========================
    CONTENT
========================== */}

                <div className="absolute bottom-10 left-7 right-7 z-20">
                  <h2 className="mb-3 text-[18px] font-semibold text-[#d6d6d6]">
                    Set up your campaign
                  </h2>

                  <p className="text-[12px] leading-[1.45] text-[#a8a8a8]">
                    Define your brief, content requirements, rules, platforms
                    and budget to tailor your campaign strategy.
                  </p>
                </div>
              </div>
              {/* Card 2 */}
              <div className="relative min-h-[515px] overflow-hidden rounded-[20px] border border-white/10 bg-[#1b1b1b]">
                {/* Campaign thumbnails sitting behind the reel */}
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

                <div className="absolute inset-0 bg-[#1b1b1b]/80" />

                {/* White haze bleeding out from behind the reel */}
                <div className="pointer-events-none absolute inset-x-6 bottom-32 top-10 rounded-[48px] bg-white/[0.12] blur-[55px]" />
                <div className="pointer-events-none absolute -left-6 top-20 h-52 w-32 rounded-full bg-white/20 blur-[55px]" />

                {/* Creator reel */}
                <div className="absolute inset-x-0 bottom-0 top-2">
                  <Image
                    src="/images/Mask group (1).png"
                    alt="Creator publishing a reel"
                    fill
                    className="object-contain object-top"
                  />
                </div>

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-[#1b1b1b]" />

                {/* Publish badge */}
                <div className="absolute right-9 top-7">
                  <span className="rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-4 py-2 text-sm font-medium text-white shadow-lg">
                    Publish
                  </span>
                </div>

                {/* Content */}
                <div className="absolute bottom-8 left-7 right-7">
                  <h3 className="mb-3 text-2xl font-semibold text-white">
                    Creators discover & publish
                  </h3>

                  <p className="text-base leading-6 text-gray-400">
                    Creators create content based on your brief, gets reviewed
                    and goes live after your approval
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div className="relative min-h-[515px] overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-[#252525] to-[#171717]">
                {/* Rewards panel */}
                <div className="absolute left-5 right-5 top-16 rounded-2xl border border-white/5 bg-[#202020]/90 p-5">
                  <h4 className="mb-5 text-base font-semibold text-white">
                    Rewards Paid
                  </h4>

                  {[
                    {
                      name: "@glow.with.me",
                      category: "Fashion & Lifestyle",
                      amount: "$420",
                    },
                    {
                      name: "@editing.daily",
                      category: "Skincare",
                      amount: "$310",
                    },
                    {
                      name: "@thatgirl.routines",
                      category: "Beauty",
                      amount: "$950",
                    },
                  ].map((user) => (
                    <div
                      key={user.name}
                      className="flex items-center justify-between border-b border-white/5 py-3 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-500/40 to-gray-500/40" />

                        <div>
                          <p className="text-xs text-gray-300">{user.name}</p>
                          <p className="text-[9px] text-gray-500">
                            {user.category}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-300">
                          {user.amount}
                        </span>

                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-[9px] text-green-400">
                          ✓ Paid
                        </span>
                      </div>
                    </div>
                  ))}

                  <p className="mt-5 text-center text-[9px] text-gray-500">
                    ▮▮ All payments are based on verified performance
                  </p>
                </div>

                {/* Content */}
                <div className="absolute bottom-8 left-7 right-7">
                  <h3 className="mb-3 text-2xl font-semibold text-white">
                    Verified results. Rewards paid.
                  </h3>

                  <p className="text-base leading-6 text-gray-400">
                    We track performance so creators get paid on results and you
                    see where your budget went.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative min-h-screen overflow-hidden bg-[#030307] py-24">
      {/* Purple background glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 opacity-70 mix-blend-screen">
        <Image
          src="/images/eda9d4af3a5188c592e888012bb7b9e177b3c04d.png"
          alt=""
          fill
          className="scale-y-[-1] object-fill"
        />
      </div>

      {/* Annotation */}
      <div className="relative z-10 mx-auto mb-24 flex max-w-[900px] justify-end px-6">
        <div className="relative mr-4">
          <p className="font-[cursive] text-xl italic text-white/75 md:text-2xl">
            Get full control to approve a reel before making live
          </p>

          {/* Curved arrow */}
          <svg
            className="absolute -bottom-20 left-24 h-24 w-24 text-white/70"
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

      {/* Main glass container */}
      <div className="relative z-10 mx-auto flex h-[475px] w-[90%] max-w-[730px] items-start justify-center overflow-hidden rounded-[18px] border border-white/15 bg-[#121212] pt-[68px] shadow-[inset_0px_0px_4.08px_0px_#FFFFFF40]">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Top-left haze */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#D9D9D9]/25 blur-[120px]" />

        {/* Submission card */}
        <div className="relative z-10 w-[485px] rounded-[18px] border border-[#353535] bg-[#171717] px-9 py-9 shadow-[8px_8px_50px_0px_#00000080] shadow-[4px_12px_4px_0px_#0000001A]">
          {/* Header */}
          <div className="mb-7 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-medium text-[#d8d8df]">
                Creator Submissions
              </h2>

              <p className="mt-1 text-sm text-[#92929a]">
                Payment are done after brand approves
              </p>
            </div>

            <p className="pt-1 text-xl font-medium text-[#d8d8df]">
              $2,000
            </p>
          </div>

          {/* Submission list */}
          <div>
            {submissions.map((submission, index) => (
              <div
                key={submission.name}
                className={`flex items-center justify-between py-4 ${
                  index !== submissions.length - 1
                    ? "border-b border-white/[0.04]"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={submission.image}
                    alt={submission.name}
                    className="h-11 w-11 rounded-full object-cover"
                  />

                  <div>
                    <h3 className="text-[16px] font-medium text-[#dedee3]">
                      {submission.name}
                    </h3>

                    <p className="mt-0.5 text-sm text-[#92929a]">
                      {submission.subtitle}
                    </p>
                  </div>
                </div>

                {submission.approved ? (
                  <span className="rounded-full bg-[#1eaa7d] px-4 py-2 text-sm font-medium text-white">
                    ✓ Approved
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-[#a3a3aa]">
                    <span className="flex h-3 w-3 items-center justify-center rounded-full border border-[#8b8b94] text-[8px]">
                      ○
                    </span>
                    Under Review
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom purple glow */}
      <div className="absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-purple-950/50 to-transparent blur-2xl" />
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
