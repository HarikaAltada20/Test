"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Heart,
  Palette,
  Star,
  Crown,
  Sparkles,
  Trophy,
  Pen,
  Users,
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
const Brandsteps = [
  {
    number: "1",
    title: "Create Your Contest",
    description:
      "Set up your contest by defining your brief, rules, and prize pool. Choose between Leaderboard or CPM contest models based on your campaign goals. Our intuitive platform makes it easy to launch and attract the perfect creators for your brand.",
    icon: <Pen className="h-8 w-8" />,
    gradient: "from-violet-600 to-purple-600",
    color: "bg-[#7F39EC87] border-4 border-[#7F39EC]",
  },
  {
    number: "2",
    title: "Creators Submit Content",
    description:
      "Access a vibrant network of creators who will submit content based on your brief. You can review, provide feedback, and ensure the content aligns with your brand's vision.",
    icon: <Users className="h-8 w-8" />,
    gradient: "from-blue-600 to-indigo-600",
    color: "bg-[#444DE787] border-4 border-[#454DE5]",
  },
  {
    number: "3",
    title: "Reward Top Performers",
    description:
      "Reward creators based on their content's views, engagement, or ranking in the contest. Choose the model that works best for your objectives: Leaderboard-based contests: Creators are ranked by their views, and payouts are based on their ranking. This motivates creators to compete for the top spots, ensuring high-quality, impactful content for your brand. CPM-based contests: Creators earn based on the number of views their content receives, regardless of their ranking. Ideal for high-volume content generation, this model rewards creators purely for engagement through views, without the pressure of ranking.",
    icon: <Trophy className="h-8 w-8" />,
    gradient: "from-amber-600 to-orange-600",
    color: "bg-[#E75D0D8F] border-4 border-[#E65D09]",
  },
];
const images: string[] = [
  "/images/f51c4c5af9b9b5ab2e591a2decd387ff602702a8.avif",
  "/images/Property 1=Rectangle 2725.avif",
  "/images/f96e2b44b8e51e5813eb9cc1fa2600d8249d865b.avif",
];
export default function BrandsClient() {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fade, setFade] = useState<boolean>(true);
  const [windowWidth, setWindowWidth] = useState<number>(0);

  const sectionRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [animate, setAnimate] = useState(false);

  const animationRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);
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

            if (entry.target === sectionRef.current) {
              setAnimate(true);
              observerInstance.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.3 } // Adjust if you want different triggers
    );

    if (animationRef.current) observer.observe(animationRef.current);
    if (howItWorksRef.current) observer.observe(howItWorksRef.current);
    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      if (animationRef.current) observer.unobserve(animationRef.current);
      if (howItWorksRef.current) observer.unobserve(howItWorksRef.current);
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // Immediately change image index and set fade true
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setFade(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-[#000825] text-white overflow-hidden">
      <div className="relative z-20">
        {/* Floating Gaming Elements */}
        <section className="pt-20 pb-20 md:pt-28 md:pb-24 relative overflow-hidden">
          {/* Strategic Background Elements */}

          {/* Floating Creative Elements */}
          <div className="inset-0 z-10 pointer-events-none">
            <Sparkles className="absolute top-20 left-10 h-8 w-8 text-amber-400/30 animate-pulse" />
            <Sparkles
              className="absolute top-32 right-20 h-9 w-9 text-violet-400/40 animate-bounce"
              style={{ animationDelay: "1s" }}
            />
            <Star
              className="absolute top-40 left-1/4 h-9 w-9 text-purple-400/30 animate-pulse"
              style={{ animationDelay: "2s" }}
            />
            <Heart
              className="absolute top-60 right-1/3 h-5 w-5 text-pink-400/40 animate-bounce"
              style={{ animationDelay: "0.5s" }}
            />
            <Palette
              className="absolute bottom-40 left-16 h-6 w-6 text-indigo-400/30 animate-pulse"
              style={{ animationDelay: "1.5s" }}
            />
            <Trophy
              className="absolute bottom-32 right-12 h-9 w-9 text-amber-400/40 animate-bounce"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
          {/* Orange Ellipse Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1200px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none bg-blue-ellipse"></div>

          <div className="container mx-auto px-4 text-center relative z-10">
            {/* Premium Badge */}
            <div className="inline-grid grid-cols-[auto_1fr] items-center gap-2 bg-[#FFFFFF1A] rounded-full px-3 py-1.5 sm:px-6 sm:py-3 mb-8 max-w-[92vw] sm:max-w-none mx-auto">
              <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
              <span className="text-xs sm:text-lg font-semibold bg-white bg-clip-text text-transparent leading-tight whitespace-normal text-left">
                #1 Gamified Creator Marketing Platform
              </span>
            </div>

            {/* Enhanced Social Icons */}
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <Image
                    src={SocialPair}
                    alt="Social Media Icons"
                    width={150}
                    height={40}
                    className="relative z-10"
                  />
                </div>
              </div>
            </div>

            {/* Massive Gaming Title */}
            <h1
              className="
    text-3xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl
    flex flex-wrap justify-center gap-x-2 md:gap-x-3 
    mb-6 leading-tight text-center slide-up
  "
              style={{ animationDelay: "1s" }}
            >
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Make your product go
              </span>

              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                <span className="relative">
                  <span
                    style={{
                      background:
                        "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      display: "inline",
                    }}
                  >
                    viral
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p
              className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
              style={{ animationDelay: "2s" }}
            >
              Launch strategic{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">
                creator contests
              </span>
              {" "}and drive organic viral marketing with{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-semibold">
                1000s of creators
              </span>
              {" "}producing content that scales your brand's reach.
            </p>
          </div>

          {/* Call-to-Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
            <BrandGetStartedButton />

            <Button
              variant="outline"
              className="rounded-3xl border-2 border-slate-400/40 text-slate-300 font-semibold px-8 py-6 text-lg hover:border-purple-400/50 hover:text-purple-400 transition-all duration-300 bg-transparent hover:bg-slate-800/20 hover:shadow-lg"
              asChild
            >
              <a href="https://youtu.be/hlQ1kXSmNvQ?si=wNjmnRgr43CNlPnx" target="_blank" rel="noopener noreferrer">
                Watch Demo
              </a>
            </Button>
          </div>
          {/* Social Proof */}
          <div className="flex justify-center items-center text-base text-slate-300 mb-8">
            <span className="font-medium">Trusted by 500+ creators and brands</span>
          </div>
        </section>

        {/* Why Brands Choose - Gaming Style */}
        <section className="text-white py-16" ref={animationRef}>
          <div className="max-w-[1200px] mx-auto px-4 md:px-12 xl:px-4 text-center">
            {/* Heading */}

            <h1
              className={`text-2xl md:text-5xl text-slate-300 max-w-4xl mx-auto mb-6 leading-relaxed drop-shadow-lg ${isAnimated ? "slide-up" : "hide-before-animate"
                }`}
            >
              <span className="text-white">Why Brands Choose </span>
              <span className="bg-gradient-to-r from-purple-500 to-purple-400 bg-clip-text text-transparent">
                Game
              </span>
              <span className="text-white"> of </span>
              <span className="bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">
                Creators
              </span>
            </h1>

            <p
              className={`text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg ${isAnimated ? "slide-left" : "hide-before-animate"
                }`}
              style={{ animationDelay: "1s" }}
            >
              Simple Steps to Launch your Influencer Marketing Campaign
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Content at Scale",
                  description:
                    "Generate dozens of unique content pieces for a fraction of the cost of traditional production.",
                  number: "1",
                  image:
                    "/images/64804a487ad8f0cf2e94705ec857e40cee3eae3f.avif",
                },
                {
                  title: "Authentic Creativity",
                  description:
                    "Tap into creator’s authentic voices and unique perspectives to connect with audiences.",
                  number: "2",
                  image:
                    "/images/b7d7011f7d816c367825ffaccca7846c99dbbfc7.avif",
                },
                {
                  title: "Performance Insights",
                  description:
                    "See exactly how your content performs and identify winners to scale through paid ads.",
                  number: "3",
                  image:
                    "/images/b4273c077c336d85dd75502201d73084ea5fba73.avif",
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="cursor-pointer relative border border-gray-500 rounded-xl p-[40px] flex flex-col items-center text-center hover:shadow-lg transition overflow-hidden group"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      backgroundImage: `url(${item.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  ></div>

                  {/* Shade Overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-[#00000066] to-[#00000099]"></div>

                  <div
                    className="relative z-10 w-[50px] h-[50px] text-3xl flex items-center justify-center rounded-full text-white font-bold mb-4"
                    style={{
                      background:
                        "linear-gradient(180deg, #7F39EC 0%, #4C238D 100%)",
                    }}
                  >
                    {item.number}
                  </div>

                  {/* Title */}
                  <h3 className="relative z-10 text-2xl md:text-3xl mt-5 font-semibold mb-2">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="relative z-10 text-gray-300 mt-5 text-lg md:text-xl">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* Gaming How It Works */}

        <section className="py-16 px-4 md:px-16 xl:px-4 text-white" ref={howItWorksRef}>
          <div className="container mx-auto max-w-[1250px]">
            <h2
              className={`text-center text-2xl sm:text-3xl md:text-4xl font-bold mb-10 ${howItWorksAnimated ? "slide-up" : "hide-before-animate"
                }`}
              style={{ animationDelay: "0.1s" }}
            >
              How it works
            </h2>

            <div className="grid lg:grid-cols-2 gap-10 items-start">
              {/* Steps */}
              <div className="space-y-16 sm:space-y-20 lg:space-y-[160px] relative z-10">
                {Brandsteps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 sm:gap-6 relative"
                  >
                    {/* Circle */}
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 md:w-[90px] md:h-[90px] rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl md:text-2xl ${step.color} flex-shrink-0 relative z-10`}
                    >
                      {step.number}
                    </div>

                    {/* Dotted line */}
                    {index < Brandsteps.length - 1 && (
                      <div
                        className="hidden lg:block absolute left-6 md:left-[45px] w-px border-l-2 border-dotted border-gray-500 z-0"
                        style={{
                          top: "90px",
                          height:
                            index === 0
                              ? windowWidth < 1100
                                ? "320px" // 1000–1099px
                                : windowWidth < 1250
                                  ? "300px" // 1100–1249px
                                  : "266px" // ≥1250px
                              : index === 1
                                ? windowWidth < 1100
                                  ? "270px" // 1000–1099px
                                  : windowWidth < 1250
                                    ? "280px" // 1100–1249px
                                    : "250px" // ≥1250px
                                : index === 2
                                  ? windowWidth < 1100
                                    ? "300px" // 1000–1099px
                                    : windowWidth < 1250
                                      ? "270px" // 1100–1249px
                                      : "180px" // ≥1250px
                                  : "40px",
                        }}
                      />
                    )}

                    <div>
                      {/* Icon */}
                      <div className="mb-4 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center border border-white rounded-md">
                        <span className="text-white">{step.icon}</span>
                      </div>

                      <h3 className="font-bold text-xl sm:text-2xl md:text-3xl">
                        {step.title}
                      </h3>
                      <p className="mt-2 sm:mt-4 text-base text-md md:text-lg text-gray-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Image */}
              <div className="relative w-full h-64 sm:h-96 md:h-[600px] lg:h-[900px] rounded-xl overflow-hidden">
                <Image
                  key={currentIndex}
                  src={images[currentIndex]}
                  alt={`Step Image ${currentIndex + 1}`}
                  fill
                  className={`object-cover rounded-xl transition-opacity duration-500 ${fade ? "opacity-100" : "opacity-0"
                    }`}
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* <NumbersSection
          items={[
            {
              numbers: [3000, 4000, 5000, 6000, 7000],
              label: "Creators on Platform",
            },
            {
              numbers: [100, 200, 300, 400, 500, 600],
              label: "Campaigns Delivered",
            },
            {
              numbers: [40, 50, 60, 70, 80],
              label: "Views Generated",
              suffix: "M",
            },
          ]}
        /> */}

        {/* Epic Stats Section */}
        {/* <section className="py-20 md:py-32 relative">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { number: "3000+", label: "Creators on Platform", icon: <Users className="h-8 w-8" />, gradient: "from-violet-600 to-purple-600" },
              { number: "100+", label: "Campaigns Delivered", icon: <Rocket className="h-8 w-8" />, gradient: "from-blue-600 to-indigo-600" },
              { number: "80M+", label: "Views Generated", icon: <TrendingUp className="h-8 w-8" />, gradient: "from-amber-600 to-orange-600" },
            ].map((stat, index) => (
              <div key={index} className="group text-center">
                <div className="relative">
                  <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} rounded-3xl blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-40`}></div>
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-3xl border border-slate-600/50 group-hover:border-violet-400/50 shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.gradient} bg-opacity-20 border border-violet-400/30 flex items-center justify-center text-violet-400 mx-auto mb-6`}>
                      {stat.icon}
                    </div>
                    <p className={`text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                      {stat.number}
                    </p>
                    <p className="text-xl text-slate-300 font-semibold">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

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
                    "The contest feature is fantastic for discovering new talent. We've found some hidden gems who are now regular contributors to our brand.",
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
                Launch your first contest today and witness the power of
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
