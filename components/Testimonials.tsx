"use client"
import Image from "next/image";
import { Crown, Sparkles, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const homeTestimonials = [
  {
    name: "Sophie Williams",
    role: "Beauty Content Creator",
    image: "./images/Ellipse 2355.png",
    quote:
      "The brands here are fantastic. I've partnered with great companies and formed strong connections.",
  },
  {
    name: "Sarah Johnson",
    role: "Marketing Director, Fashion Brand",
    image: "./images/Ellipse 2355 (3).png",
    quote:
      "Game Of Creators revamped our content strategy, producing 50 unique pieces in two weeks and boosting engagement.",
  },
  {
    name: "Mike Chen",
    role: "Founder, Tech Startup",
    image: "./images/Ellipse 2355 (1).png",
    quote:
      "The Game of Creators has streamlined our workflow and boosted efficiency",
  },
  {
    name: "Emma Rodriguez",
    role: "CMO, E- commerce Platform",
    image: "./images/Ellipse 2355 (2).png",
    quote:
      "Game Of Creators exceeded our expectations, enhancing our brand with authentic creator content.",
  },
  {
    name: "James Carter",
    role: "Software Engineer",
    image: "./images/Ellipse 2355 (4).png",
    quote:
      "The Game Of Creators streamlined our workflow and boosted efficiency.",
  },
  {
    name: "Emily Clark",
    role: "Lifestyle Blogger",
    image: "./images/Ellipse 2355 (6).png",
    quote:
      "Collaborating with skilled creators here has been seamless. The content quality was impressive, leading to a great ROI.",
  },
  {
    name: "Lisa Chen",
    role: "Head of Digital Marketing, SaaS Company",
    image: "./images/Ellipse 2355 (7).png",
    quote:
      "A platform that truly aligns brand goals with creator strengths, ensuring a smooth and effective collaboration process.",
  },
  {
    name: "Olivia White",
    role: "Fashion Influencer",
    image: "./images/Ellipse 2355 (1).png",
    quote:
      "This community is amazing — full of supportive and inspiring people.",
  },
];

const brandsTestimonials = [
  {
    name: "Sophie Williams",
    role: "Beauty Content Creator",
    image: "./images/Ellipse 2355.png",
    quote:
      "The brands here are fantastic. I've partnered with great companies and formed strong connections.",
  },
  {
    name: "Sarah Johnson",
    role: "Marketing Director, Fashion Brand",
    image: "./images/Ellipse 2355 (3).png",
    quote:
      "Game Of Creators revamped our content strategy, producing 50 unique pieces in two weeks and boosting engagement.",
  },
  {
    name: "Mike Chen",
    role: "Founder, Tech Startup",
    image: "./images/Ellipse 2355 (1).png",
    quote:
      "The Game of Creators has streamlined our workflow and boosted efficiency",
  },
  {
    name: "Emma Rodriguez",
    role: "CMO, E- commerce Platform",
    image: "./images/Ellipse 2355 (2).png",
    quote:
      "Game Of Creators exceeded our expectations, enhancing our brand with authentic creator content.",
  },
  {
    name: "James Carter",
    role: "Software Engineer",
    image: "./images/Ellipse 2355 (4).png",
    quote:
      "The Game Of Creators streamlined our workflow and boosted efficiency.",
  },
  {
    name: "Emily Clark",
    role: "Lifestyle Blogger",
    image: "./images/Ellipse 2355 (6).png",
    quote:
      "Collaborating with skilled creators here has been seamless. The content quality was impressive, leading to a great ROI.",
  },
  {
    name: "Lisa Chen",
    role: "Head of Digital Marketing, SaaS Company",
    image: "./images/Ellipse 2355 (7).png",
    quote:
      "A platform that truly aligns brand goals with creator strengths, ensuring a smooth and effective collaboration process.",
  },
  {
    name: "Olivia White",
    role: "Fashion Influencer",
    image: "./images/Ellipse 2355 (1).png",
    quote:
      "This community is amazing — full of supportive and inspiring people.",
  },
];

const creatorsTestimonials = [
  {
    name: "Sophie Williams",
    role: "Beauty Content Creator",
    image: "./images/Ellipse 2355.png",
    quote:
      "The brands here are fantastic. I've partnered with great companies and formed strong connections.",
  },
  {
    name: "Alex Thompson",
    role: "Tech Reviewer & YouTuber",
    image: "./images/Ellipse 2355 (3).png",
    quote:
      "Grew from zero to 100K followers in 8 months through brand collaborations. This platform transformed my life!",
  },
  {
    name: "Marcus Rivera",
    role: "Fitness Influencer & Coach",
    image: "./images/Ellipse 2355 (1).png",
    quote:
      "Game Of Creators turned my passion into a full-time income, inspiring my best work.",
  },
  {
    name: "Aisha Khan",
    role: "Travel Vlogger & Influencer",
    image: "./images/Ellipse 2355 (2).png",
    quote:
      "A platform that truly gets the creator economy, offering diverse opportunities and a supportive community.",
  },
  {
    name: "James Carter",
    role: "Software Engineer",
    image: "./images/Ellipse 2355 (4).png",
    quote:
      "The Game Of Creators streamlined our workflow and boosted efficiency.",
  },
  {
    name: "Emily Clark",
    role: "Lifestyle Blogger",
    image: "./images/Ellipse 2355 (6).png",
    quote:
      "Collaborating here opened doors to amazing partnerships and growth.",
  },
  {
    name: "Daniel Kim",
    role: "Photographer",
    image: "./images/Ellipse 2355 (7).png",
    quote:
      "A fantastic platform to connect with brands and showcase my creativity.",
  },
  {
    name: "Olivia White",
    role: "Fashion Influencer",
    image: "./images/Ellipse 2355 (1).png",
    quote:
      "This community is amazing — full of supportive and inspiring people.",
  },
];

const config = {
  "/": {
    testimonials: homeTestimonials,
    button: { text: "Our Customers", icon: Users },
    gradientText: "linear-gradient(180deg, #7F39EC 33.29%, #B16FF4 81.2%)",
    headingWord: "People",
    description:
      "Creators often commend our platform for its top-notch quality, user-friendly interface, and remarkable customer service.",
    blurColor: "#7F39EC",
    iconSrc: "./images/Frame 2147207526 (1).png",
  },
  "/brands": {
    testimonials: brandsTestimonials,
    button: { text: "Our Brands", icon: Crown },
    gradientText: "linear-gradient(180deg, #7F39EC 33.29%, #B16FF4 81.2%)",

    headingWord: "Brands",
    description:
      "Brands appreciate our platform for connecting them with top-tier talent and boosting campaigns.",
    blurColor: "#7F39EC",
    iconSrc: "./images/Frame 2147207526 (1).png",
  },
  default: {
    testimonials: creatorsTestimonials,
    button: { text: "Our Creators", icon: Sparkles },
    gradientText: "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
    headingWord: "Creators",
    description:
      "Creators love our platform for its user-friendly interface, diverse opportunities, and supportive community.",
    blurColor: "#FF652D",
    iconSrc: "./images/Frame 2147207526.png",
  },
};

export default function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const [headingAnimated, setHeadingAnimated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  const key = (
    pathname in config ? pathname : "default"
  ) as keyof typeof config;
  const {
    testimonials,
    button,
    gradientText,
    headingWord,
    description,
    blurColor,
    iconSrc,
  } = config[key];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHeadingAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (headingRef.current) observer.observe(headingRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const ButtonIcon = button.icon;

  // split into 2 rows for desktop
  const rows = [];
  for (let i = 0; i < testimonials.length; i += 4) {
    rows.push(testimonials.slice(i, i + 4));
  }

  return (
    <section className="text-white py-10 md:py-20 px-6" ref={sectionRef}>
      {/* Heading */}
      <div className="text-center max-w-3xl mx-auto" ref={headingRef}>
        <button className="bg-[#2C3247] text-white py-1 px-4 rounded-full text-lg mb-8 flex items-center justify-center mx-auto gap-2">
          <ButtonIcon size={16} />
          <span>{button.text}</span>
        </button>
        <h2
          className={`text-3xl md:text-5xl font-bold mb-7 ${
            headingAnimated ? "slide-up" : "hide-before-animate"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          What{" "}
          <span
            className="bg-clip-text text-transparent mx-2"
            style={{ backgroundImage: gradientText }}
          >
            {headingWord}
          </span>{" "}
          {pathname === "/" ? "are Saying" : "Say About Us"}
        </h2>
        <p
          className={`text-xl text-gray-300 ${
            headingAnimated ? "slide-left" : "hide-before-animate"
          }`}
          style={{ animationDelay: "1s" }}
        >
          {description}
        </p>
      </div>

      {/* Testimonials */}
      {isMobile ? (
        <div className="mt-12 h-[550px] overflow-hidden relative">
          <div className="flex flex-col animate-scroll-vertical">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div
                key={i}
                className="p-6 rounded-xl border border-gray-700 mb-6 w-full max-w-md mx-auto"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-start gap-2">
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <div
                          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full blur-lg opacity-30 pointer-events-none"
                          style={{ backgroundColor: blurColor }}
                        ></div>
                        <Image
                          src={iconSrc}
                          alt="quote"
                          width={32}
                          height={32}
                          className="relative z-10 object-contain"
                        />
                      </div>
                      <p className="font-poppins ml-1 text-gray-200">
                        {t.quote}
                      </p>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-bold">{t.name}</h4>
                      <p className="text-sm text-gray-400">{t.role}</p>
                    </div>
                  </div>
                  <Image
                    src={t.image}
                    alt={t.name}
                    width={50}
                    height={50}
                    className="rounded-full object-cover flex-shrink-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-12 space-y-8">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="overflow-hidden relative scroll-container-testimonials"
            >
              <div
                className={`flex justify-center gap-6 ${
                  rowIndex % 2 === 0
                    ? "animate-scroll-left"
                    : "animate-scroll-right"
                }`}
              >
                {[...row, ...row].map((t, i) => (
                  <div
                    key={i}
                    className="p-6 rounded-xl border border-gray-700 flex-shrink-0 w-[320px] sm:w-[400px] md:w-[500px] max-w-full mx-auto mb-6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-start gap-2">
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <div
                              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full blur-lg opacity-30 pointer-events-none"
                              style={{ backgroundColor: blurColor }}
                            ></div>
                            <Image
                              src={iconSrc}
                              alt="quote"
                              width={32}
                              height={32}
                              className="relative z-10 object-contain"
                            />
                          </div>
                          <p className="font-poppins ml-1 text-gray-200">
                            {t.quote}
                          </p>
                        </div>
                        <div className="mt-4">
                          <h4 className="font-bold">{t.name}</h4>
                          <p className="text-sm text-gray-400">{t.role}</p>
                        </div>
                      </div>
                      <Image
                        src={t.image}
                        alt={t.name}
                        width={50}
                        height={50}
                        className="rounded-full object-cover flex-shrink-0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
