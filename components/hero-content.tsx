"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

import Link from "next/link";

import {
  ArrowRight,
  ArrowLeft,
  Trophy,
  Users,
  Gamepad2,
  Headset,
  Sparkles,
  Crown,
  Globe,
  Rocket,
  Star,
  Palette,
  Heart,
  User,
  Users2,
} from "lucide-react";
import socialPair from "@/public/images/social_pair.avif";
import { useSwipeable } from "react-swipeable";
import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import CtcBanner from "./CtcBanner";
import NumbersSection from "./NumberSection";
const steps = [
  {
    step: 1,
    title: "Brands Create a Contest",
    description:
      "Share your vision. Describe your product, set the rules, and offer a prize. Decide how you want creators to promote your brand or product.",
    image: "/images/da37f744f2ba86471c20ded62e5befaccbcabd69.avif",
    icon: <Trophy className="w-6 h-6 text-white" />,
  },
  {
    step: 2,
    title: "Open to Everyone",
    description:
      "Your follower count doesn't matter. Whether you have zero followers or millions, you can join any contest that inspires you. Pick a challenge, showcase your talent, and stand out! ",

    image: "/images/4cb24974041cac85c7df83d9aaf0e54514c37f92.avif",
    icon: <Users className="w-6 h-6 text-white" />,
  },
  {
    step: 3,
    title: "Rewards & Results, Guaranteed",
    description:
      "A clear victory for both sides. Creators win cash prizes based on there performance and build their reputation. Brands get a library of high-impact, authentic content with full ownership and trackable results.",

    image: "/images/f4d15163b849dc0a3621c67aba3032911859d498.avif",
    icon: <Sparkles className="w-6 h-6 text-white" />,
  },
];
// const features = [
//   {
//     title: "Authentic Content",
//     description:
//       "Generate genuine, viral-worthy content that your audience will love and share.",
//     icon: "/images/authentic-icon.png", // replace with your icon
//   },
//   {
//     title: "Easy Management",
//     description:
//       "Manage all your campaigns from one intuitive, game-like dashboard interface.",
//     icon: "/images/calendar-icon.png",
//   },
//   {
//     title: "Real-Time Analytics",
//     description:
//       "Track every view, like, and conversion with our advanced analytics dashboard.",
//     icon: "/images/pie-icon.png",
//   },
//   {
//     title: "Cost Effective",
//     description:
//       "Get10x better ROI compared to traditional advertising. Every dollar counts!",
//     icon: "/images/cost-icon.png",
//   },
//   {
//     title: "Targeted Reach",
//     description:
//       "Connect with creators, whose audience perfectly match your ideal customers.",
//     icon: "/images/target-icon.png",
//   },
//   {
//     title: "Gaming Dashboard",
//     description: "Level up your campaigns with our intuitive interface.",
//     icon: "/images/game-icon.png",
//   },
//   {
//     title: "24/7 Support",
//     description: "Our gaming experts are always ready to help you win big!",
//     icon: "/images/support-icon.png",
//   },
// ];

export default function HeroContent() {
  const [activeIndex, setActiveIndex] = useState(0);

  const [animate, setAnimate] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);

  const [worksVisible, setWorksVisible] = useState(false);
  // const [chooseVisible, setChooseVisible] = useState(false);
  const [reasonsVisible, setReasonsVisible] = useState(false);

  const worksRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<HTMLDivElement>(null);
  const reasonsRef = useRef<HTMLDivElement>(null);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? steps.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
  };

  // ✅ Auto infinite scroll every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
    }, 6000);

    return () => clearInterval(interval);
  }, [steps.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === worksRef.current) setWorksVisible(true);
            // if (entry.target === chooseRef.current) setChooseVisible(true);
            if (entry.target === reasonsRef.current) setReasonsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (worksRef.current) observer.observe(worksRef.current);
    // if (chooseRef.current) observer.observe(chooseRef.current);
    if (reasonsRef.current) observer.observe(reasonsRef.current);

    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setAnimate(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);
  const handlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrev(),
    trackTouch: true,
    trackMouse: false,
    touchEventOptions: { passive: false }, // 👈 replaces preventDefaultTouchmoveEvent
  });

  return (
    <div>
      <section className="relative flex flex-col items-center justify-center py-16 text-center text-white overflow-hidden">
        {/* Background Circles */}

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
        <div
          className={`absolute w-[600px] h-[600px] border-[2px] border-purple-500/20 rounded-full`}
        ></div>
        <div
          className={`absolute w-[800px] h-[800px] border-[2px] border-purple-500/20 rounded-full`}
        ></div>
        <div
          className={`absolute w-[1000px] h-[1000px] border-[2px] border-purple-500/20 rounded-full`}
        ></div>

        {/* Revolving arc */}
        <div className="absolute w-[800px] h-[800px] rounded-full animate-spin-slow">
          <div
            className={`absolute inset-0 rounded-full border-[3px] border-transparent border-t-purple-500`}
            style={{
              clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)",
            }}
          ></div>
        </div>
        <div className="absolute w-[1000px] h-[1000px] rounded-full animate-spin-slow-reverse">
          <div
            className={`absolute inset-0 rounded-full border-[3px] border-transparent border-t-purple-500`}
            style={{
              clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)",
            }}
          ></div>
        </div>

        <div className="inline-flex items-center gap-2 bg-[#FFFFFF1A] rounded-full px-6 py-3 mb-8">
          <Crown className="h-5 w-5 text-white" />
          <span className="text-lg font-semibold bg-white bg-clip-text text-transparent">
            #1 Creator Marketing Platform
          </span>
        </div>

        {/* Logos */}
        <div className="flex justify-center mb-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <Image
                src={socialPair}
                alt="Social Media Icons"
                width={150}
                height={40}
                className="relative z-10"
              />
            </div>
          </div>
        </div>
        {/* Title */}
        <h1
          className="text-4xl flex justify-center gap-x-3 md:text-6xl lg:text-7xl mb-6 leading-tight slide-up"
          style={{ animationDelay: "1s" }}
        >
          Game <span className="text-white">Of</span>{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
            }}
          >
            Creators
          </span>
        </h1>

        <p
          className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
          style={{ animationDelay: "2s" }}
        >
          Where <span className="text-orange-400">Creators</span> and{" "}
          <span className="text-purple-400">Brands</span> Win Together
        </p>

        {/* Buttons */}

        <div className="flex flex-col sm:flex-row gap-4 mt-8 sm:mt-10 relative">
          <Link href="/brands" passHref>
            <button
              className="rounded-3xl relative text-white font-bold px-8 py-3 text-lg overflow-hidden flex items-center gap-2"
              style={{
                background:
                  "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
              }}
            >
              <div className="scan-line"></div>
              <Crown className="h-5 w-5" />
              I'm a Brand
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
          <Link href="/creators" passHref>
            <button className="rounded-3xl relative text-white font-bold px-8 py-3 text-lg overflow-hidden flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-700">
              <div className="scan-line"></div>
              <Sparkles className="h-5 w-5" />
              I'm a Creator
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
        </div>
      </section>
      {/* <div className="ellipse-design"></div> */}

      <section
        className="relative h-[250px] sm:h-[300px] md:h-[400px] lg:h-[500px] z-10 overflow-hidden"
        ref={sectionRef}
      >
        {/* Semi-circle background */}
        <div
          className="absolute top-0 left-0 w-full flex flex-col text-center"
          style={{
            height: "50vw", // scales with screen width
            borderTopLeftRadius: "50vw",
            borderTopRightRadius: "50vw",
            background:
              "linear-gradient(360deg, rgba(55, 37, 110, 0.5) 0%, rgba(0, 8, 37, 0.5) 34.49%)",
            boxShadow:
              "1px -5px 20px 0px #D0BCFF42, 0px 46px 91.9px 0px #BC83FA91 inset",
            backdropFilter: "blur(34.2px)",
          }}
        >
          <div className="mt-8 sm:mt-14 md:mt-20 lg:mt-40">
            <h2
              className={`text-white text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold ${animate ? "slide-up" : "opacity-0"
                }`}
            >
              <span className="text-purple-400">Creative</span>{" "}
              <span className="text-orange-400">Showcase</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center mt-4 gap-3 sm:gap-5 flex-wrap">
              <span
                className={`text-gray-300 text-sm sm:text-base md:text-lg font-medium ${animate ? "slide-left" : "opacity-0"
                  }`}
                style={{ animationDelay: "0.3s" }}
              >
                Join 50,000+ Active Creators
              </span>

              {/* Avatar Stack */}
              <div
                className={`flex -space-x-2 sm:-space-x-3 ${animate ? "slide-up" : "opacity-0"
                  }`}
                style={{ animationDelay: "0.6s" }}
              >
                {[
                  "434ce5e441255007a5349fd85232df9726062927.avif",
                  "028df62b75a0a5e07e3025b313d8b74cda06d987.avif",
                  "f3a549313a8c77a542d9239fdd18733c34787a69.avif",
                  "f0c4aef454fceee8af51bb454a70238d17ad978a.avif",
                  "776584be4e29200a5a72df8ebba39153a4aa21b6.avif",
                ].map((img, idx) => (
                  <Image
                    key={idx}
                    src={`/images/${img}`}
                    alt={`Creator ${idx + 1}`}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full border-2 border-gray-500"
                    sizes="(min-width: 1024px) 48px, (min-width: 640px) 40px, 32px"
                  />
                ))}
              </div>

              {/* <span
                  className={`text-gray-300 text-sm sm:text-base md:text-lg font-medium ${
                    chooseVisible ? "slide-right" : "opacity-0"
                  }`}
                  style={{ animationDelay: "1.2s" }}
                >
                  3000+ Active Creators
                </span> */}
            </div>
          </div>
        </div>
      </section>

      <div className="absolute bottom-[80px] lg:bottom-[90px] left-1/2 -translate-x-1/2 z-20 w-full scroll-container">
        <div className="scroll-track">
          {[
            "/images/434ce5e441255007a5349fd85232df9726062927.avif",
            "/images/028df62b75a0a5e07e3025b313d8b74cda06d987.avif",
            "/images/f3a549313a8c77a542d9239fdd18733c34787a69.avif",
            "/images/deff86ae51601b2f5dcbe09c5c677dbdac8680c5.avif",
            "/images/789ee6238c4c890fd4315ca0b2baad140bd22410.avif",
            "/images/14f2649763f196d1c4636f67f952c24d1ffd273d.avif",
            "/images/f0c4aef454fceee8af51bb454a70238d17ad978a.avif",
            "/images/776584be4e29200a5a72df8ebba39153a4aa21b6.avif",
          ]
            .concat([
              "/images/434ce5e441255007a5349fd85232df9726062927.avif",
              "/images/028df62b75a0a5e07e3025b313d8b74cda06d987.avif",
              "/images/f3a549313a8c77a542d9239fdd18733c34787a69.avif",
              "/images/deff86ae51601b2f5dcbe09c5c677dbdac8680c5.avif",
              "/images/789ee6238c4c890fd4315ca0b2baad140bd22410.avif",
              "/images/14f2649763f196d1c4636f67f952c24d1ffd273d.avif",
              "/images/f0c4aef454fceee8af51bb454a70238d17ad978a.avif",
              "/images/776584be4e29200a5a72df8ebba39153a4aa21b6.avif",
            ]) // duplicate images for seamless loop
            .map((src, idx) => (
              <div
                key={idx}
                className="relative w-[80px] h-[150px] md:w-[150px] md:h-[250px] rounded-[40%] overflow-hidden shadow-lg mx-5"
                style={{
                  clipPath: "ellipse(50% 50% at 50% 50%)",
                }}
              >
                <Image
                  src={src}
                  alt={`Person ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 150px, 80px"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            ))}
        </div>
      </div>

      <section
        ref={worksRef}
        className="text-white px-8 py-0 md:py-16 relative"
      >
        <div className="max-w-7xl custom-max-w mx-auto text-center relative">
          {/* Tagline */}
          <div className="flex justify-center mb-5">
            <span className="bg-[#2C3247] text-sm sm:text-base md:text-lg px-3 sm:px-4 py-1 sm:py-2 rounded-full flex items-center gap-2">
              <Image
                src="/images/streamline-sharp_user-work-laptop-wifi.png"
                alt="Work laptop with wifi icon"
                width={24}
                height={24}
                className="w-5 h-5 sm:w-6 sm:h-6"
                loading="lazy"
              />
              Enhance your Marketing skills
            </span>
          </div>

          {/* Title */}
          <h2
            className={`text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 leading-snug ${worksVisible ? "slide-up" : "opacity-0"
              }`}
          >
            How <span className="text-purple-400">Game</span> of{" "}
            <span className="text-orange-400">Creators</span> Works
          </h2>

          {/* Subtitle */}
          <p
            className={`text-center text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8 md:mb-12 px-2 ${worksVisible ? "slide-left" : "opacity-0"
              }`}
          >
            Three simple steps to launch your viral marketing campaign and
            dominate the game
          </p>

          {/* Active Step */}
          <div
            {...handlers}
            className="flex flex-col gap-1 md:flex-row max-w-[1250px] mx-auto relative"
          >
            {/* Left Arrow */}
            <button
              onClick={handlePrev}
              aria-label="Previous slide"
              className="hidden md:flex absolute arrow-btn -left-20 top-1/2 -translate-y-1/2 border-2 rounded-full transition w-12 h-12 items-center justify-center"
            >
              <ArrowLeft className="w-7 h-7 text-white" />
            </button>

            {/* Image */}
            <div className="w-full md:w-1/2 relative aspect-square md:aspect-auto md:h-auto">
              <Image
                src={steps[activeIndex].image}
                alt={steps[activeIndex].title}
                fill
                className="object-cover rounded-xl"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </div>

            {/* Content */}
            <div className="w-full md:w-1/2 border-2 rounded-xl p-6 border-gray-600 sm:p-8 flex flex-col justify-start relative left-0 lg:left-2 text-left">
              {/* Step Indicator */}
              <div className="flex mb-4 sm:mb-6 items-center justify-between">
                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white/60 bg-transparent">
                  {steps[activeIndex].icon}
                </div>

                <div className="relative px-3 py-0.5 sm:px-5 sm:py-1 rounded-full text-md sm:text-lg font-semibold text-white border-2 border-white/60">
                  Step {steps[activeIndex].step}
                </div>
              </div>

              <div className="mt-6 sm:mt-10">
                {/* Title */}
                <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 sm:mb-4 text-left">
                  {steps[activeIndex].title}
                </h3>

                {/* Description */}
                <p className="text-gray-300 text-base sm:text-lg md:text-xl mb-6 sm:mb-10 text-left">
                  {steps[activeIndex].description}
                </p>



                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 relative z-10"
                >
                  <button
                    className="px-5 mb-4 sm:px-6 py-1.5 sm:py-2 relative rounded-full inline-flex items-center gap-2 overflow-hidden self-start text-sm md:text-lg sm:text-base"
                    style={{
                      background:
                        "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                    }}
                  >

                    <div className="scan-line"></div>
                    Start Now
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />

                  </button>
                </Link>
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={handleNext}
              aria-label="Next slide"
              className="hidden md:flex absolute arrow-btn -right-20 top-1/2 -translate-y-1/2 border-2 rounded-full transition w-12 h-12 items-center justify-center"
            >
              <ArrowRight className="w-7 h-7 text-white" />
            </button>
          </div>

          {/* Dots Navigation */}
          <div className="flex justify-center mt-6 sm:mt-10 gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                aria-label={`Go to step ${index + 1}`}
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors ${activeIndex === index ? "bg-purple-600" : "bg-gray-600"
                  }`}
              ></button>
            ))}
          </div>
        </div>
      </section>

      {/* Reasons to Select Us */}

      <section ref={reasonsRef} className="text-white px-10 py-20">
        <div className="max-w-[1250px] mx-auto">
          {/* Tagline */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-5">
              <span className="bg-[#2C3247] text-sm sm:text-base md:text-lg px-3 sm:px-4 py-1 sm:py-2 rounded-full flex items-center gap-2">
                <img
                  src="./images/tabler_award.png"
                  alt="icon"
                  className="w-5 h-5"
                />
                Reasons to Select Us
              </span>
            </div>

            {/* <button className="bg-[#2C3247] text-base sm:text-lg px-4 py-1 rounded-full mb-6">
                Reasons to Select Us
              </button> */}
            <h2
              className={`text-2xl sm:text-3xl md:text-5xl font-bold mb-4 leading-snug ${reasonsVisible ? "slide-up" : "opacity-0"
                }`}
            >
              Why Choose{" "}
              <span className="bg-gradient-to-r from-purple-500 to-orange-400 bg-clip-text text-transparent">
                Game of Creators
              </span>
            </h2>
            <p
              className={`text-gray-300 text-base sm:text-lg md:text-xl ${reasonsVisible ? "slide-left" : "opacity-0"
                }`}
            >
              We're not just a platform – we're your competitive advantage in
              the creator economy.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/5b9ccb0130cdd4c8b6a76dccd99f879f41ba8fe2.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>

              <h3 className="text-xl sm:text-2xl font-semibold mb-2 relative z-10">
                Organic Content at Scale
              </h3>
              <p className="text-gray-400 text-base md:text-md relative z-10">
                With Game of Creators, you generate a high volume of diverse,
                high-quality content-without the hassle of sourcing,
                negotiating, or managing creators manually.
              </p>
            </div>

            {/* 2 */}
            <div
              className="sm:col-span-2 h-auto border border-gray-700 rounded-xl overflow-hidden flex flex-col sm:flex-row items-center p-4 sm:p-6 relative group
           
              [@media(min-width:1000px)_and_(max-width:1246px)]:h-[300px] 
              
              [@media(min-width:1246px)]:h-[250px] "
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/477657f97d63845e03dfc9060e1005e8d8d651df.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/40 group-hover:opacity-0 transition-opacity duration-300"></div>

              <div className="flex-1 relative z-10 mb-4">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  Supply and Demand Based Platform
                </h3>
                <p className="text-gray-400 text-base sm:text-lg">
                  Game of Creators operated on a supply and demand model.
                  Creators complete, allowing the best ideas to surface
                  organically and driving higher engagement and reach.
                </p>
              </div>
              <div
                className="relative w-[200px] h-[200px] 
               sm:w-[250px] sm:h-[250px] 
               md:w-[250px] md:h-[250px] 
               [@media(min-width:1000px)_and_(max-width:1080px)]:w-[200px] 
              [@media(min-width:1000px)_and_(max-width:1080px)]:h-[200px] 
               [@media(min-width:1080px)_and_(max-width:1200px)]:w-[250px] 
              [@media(min-width:1000px)_and_(max-width:1200px)]:h-[250px] 
               [@media(min-width:1200px)]:w-[300px] 
              [@media(min-width:1200px)]:h-[300px] 
                 flex-shrink-0"
              >
                <Image
                  src="/images/bb14a2a8c3979fb268076c3bbb96eaf152d1a0f8.avif"
                  alt="Calendar"
                  fill
                  className="object-contain"
                  sizes="(min-width: 1200px) 300px, (min-width: 1080px) 250px, (min-width: 1000px) 200px, 200px"
                />
                <div className="absolute inset-0 bg-[#000825]/60 group-hover:opacity-0 transition-opacity duration-300"></div>
              </div>
            </div>

            {/* 3 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/cc72cdf71f826fc780265eb7ba34b2b7a5e3c2c2.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>

              <h3 className="text-xl sm:text-2xl font-semibold mb-2 relative z-10">
                Find Content- market Fit
              </h3>
              <p className="text-gray-400 text-base sm:text-lg relative z-10">
                Validate creative concepts with real audience engagement.
              </p>
            </div>

            {/* 4 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/55970240f7b24d6eff2af2d8d8537bd017058e58.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/40 group-hover:opacity-0 transition-opacity duration-300"></div>

              <Rocket className="text-white mb-4 relative z-10" size={26} />
              <h3 className="text-lg sm:text-xl mb-2 relative z-10">
                Only Pay for Top Performing Content
              </h3>
              <p className="text-gray-400 text-base sm:text-lg relative z-10">
                Stop wasting money on content that doesn’t covert. Pay only for
                videos that perform.
              </p>
            </div>

            {/* 6 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/b4273c077c336d85dd75502201d73084ea5fba73.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>
              <Users2 className="text-white mb-4 relative z-10" size={26} />
              <h3 className="text-xl sm:text-xl mb-2 relative z-10">
                Skip the Creator Outreach Hassle
              </h3>
              <p className="text-gray-400 text-base sm:text-lg relative z-10">
                No more hours spent negotiating, coordinating, and following up.
                With Game of Creators, the creators come to you.
              </p>
            </div>

            <div className="sm:col-span-2 border border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row justify-center items-center text-start relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/2a6d9ad13dd40e9b3b4f90b35cf0f9324af8dda7.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>

              <div className="flex-1 mb-4 sm:mb-0 px-2 relative z-10">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  Scale Winners on Paid Ads
                </h3>
                <p className="text-gray-400 text-base sm:text-lg">
                  Identify the best-performing content and seamlessly scale it
                  into paid campaigns. With proven, audience-validated content,
                  your ads drive higher engagement, lower costs, and better
                  conversions.
                </p>
              </div>
              <div className="relative w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] lg:w-[230px] lg:h-[230px] flex-shrink-0">
                <Image
                  src="/images/0045df9e9f7db84c983cc6c5675c55189fa040a2.avif"
                  alt="Target"
                  fill
                  className="object-contain"
                  sizes="(min-width: 1024px) 230px, (min-width: 640px) 200px, 180px"
                />
                <div className="absolute inset-0 bg-[#000825]/60 group-hover:opacity-0 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="border border-gray-700 rounded-xl p-8 md:p-10 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/c90e07a57a2d08340f7c0d3c57b1fde4a6f0f9cd.avif')",
                }}
              ></div>

              <Globe className="text-white mb-4 relative z-10" size={30} />
              <h3 className="text-lg md:text-2xl font-semibold mb-3 relative z-10">
                Democratised Brands Deals
              </h3>
              <p className="text-gray-400 text-base text-md md:text-lg relative z-10">
                Every creator, no . matter their follower count, can join and
                win. Success is based on creativity and performance-not just
                popularity.
              </p>
            </div>

            <div className="border border-gray-700 rounded-xl p-8 md:p-10 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/f1dc449ff317e5ede74929b2af2d4ef5b82c298f.avif')",
                }}
              ></div>

              <Headset className="text-white mb-4 relative z-10" size={30} />
              <h3 className="text-lg md:text-2xl font-semibold mb-3 relative z-10">
                24/7 Support
              </h3>
              <p className="text-gray-400 text-base text-md md:text-xl relative z-10">
                Our team is always ready to help you win big with Game of
                Creators!
              </p>
            </div>

            <div className="border border-gray-700 rounded-xl p-8 md:p-10 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/5ce917bc44f4c6db1590e3478c916a367eacfe8a.avif')",
                }}
              ></div>

              <Palette className="text-white mb-4 relative z-10" size={30} />
              <h3 className="text-lg md:text-2xl font-semibold mb-3 relative z-10">
                Creator Freedom of Choice
              </h3>
              <p className="text-gray-400 text-base text-md md:text-lg relative z-10">
                Creators choose which brands and campaigns to promote,
                empowering them to work with what they love and get paid for it.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* <NumbersSection
          items={[
            {
              numbers: [100, 200, 300, 400, 500],
              label: "Active Creators",
            },
            {
              numbers: ["$0.5", "$1.5", "$2.5", "$3.5", "$4.5", "$5.5"],
              label: "Rewards Paid",
              suffix: "M",
            },
            {
              numbers: ["$60", "$70", "$80", "$90", "$100"],
              label: "View Generated",
              suffix: "M",
            },
          ]}
        /> */}
    </div>
  );
}
