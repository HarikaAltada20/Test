import Image from "next/image";
import { Crown, Sparkle, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
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

export default function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const pathname = usePathname();
  const blurColor = pathname === "/brands" ? "#7F39EC" : "#FF652D";
  // Pick dataset based on route
  const testimonials =
    pathname === "/brands" ? brandsTestimonials : creatorsTestimonials;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const rows = [];
  for (let i = 0; i < testimonials.length; i += 4) {
    rows.push(testimonials.slice(i, i + 4));
  }

  const iconSrc =
    pathname === "/brands"
      ? "./images/Frame 2147207526 (1).png"
      : "./images/Frame 2147207526.png";

  const buttonConfig =
    pathname === "/brands"
      ? { text: "Our Brands", icon: Crown }
      : { text: "Our Brands", icon: Sparkles };

  const gradientText =
    pathname === "/brands"
      ? "linear-gradient(180deg, #7F39EC 33.29%, #B16FF4 81.2%)" // Purple gradient for brands
      : "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)"; // Orange gradient for creators

  return (
    <section className="text-white py-20 px-6" ref={sectionRef}>
      {/* Heading */}
      <div className="text-center max-w-3xl mx-auto">
        <button className="bg-[#2C3247] text-white py-1 px-4 rounded-full text-lg mb-8 flex items-center justify-center mx-auto gap-2">
          <buttonConfig.icon size={16} />
          <span>{buttonConfig.text}</span>
        </button>
        <h2
          className={`text-3xl md:text-5xl font-bold mb-7 ${
            isAnimated ? "slide-up" : "hide-before-animate"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          What{" "}
          <span
            className="bg-clip-text text-transparent mx-2"
            style={{ backgroundImage: gradientText }}
          >
            {pathname === "/brands" ? "Brands" : "Creators"}
          </span>
          Say About Us
        </h2>
        <p
          className={`text-xl text-gray-300 ${
            isAnimated ? "slide-left" : "hide-before-animate"
          }`}
          style={{ animationDelay: "1s" }}
        >
          {pathname === "/brands"
            ? "Brands appreciate our platform for connecting them with top-tier talent and boosting campaigns."
            : "Creators love our platform for its user-friendly interface, diverse opportunities, and supportive community."}
        </p>
      </div>

      {/* Rows */}
      <div className="mt-12 space-y-8">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="overflow-hidden relative">
            <div
              className={`flex justify-center gap-6 scroll-row ${
                rowIndex % 2 === 0
                  ? "scroll-right-seamless"
                  : "scroll-left-seamless"
              }`}
            >
              {[...row, ...row].map((t, i) => (
                <div
                  key={i}
                  className="p-8 rounded-xl border border-gray-700 flex-shrink-0 w-[500px]"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Quote + Name + Role */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        {/* Image with orange shade background */}
                        <div className="relative w-8 h-8 flex-shrink-0">
                          <div
                            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 
    w-16 h-16 rounded-full blur-lg opacity-30 pointer-events-none"
                            style={{ backgroundColor: blurColor }}
                          ></div>

                          {/* Icon image */}
                          <Image
                            src={iconSrc}
                            alt="quote"
                            width={32}
                            height={32}
                            className="relative z-10 object-contain"
                          />
                        </div>

                        {/* Quote text */}
                        <p className="font-poppins ml-1 text-gray-200">
                          {t.quote}
                        </p>
                      </div>

                      <div className="mt-6">
                        <h4 className="font-bold">{t.name}</h4>
                        <p className="text-sm text-gray-400">{t.role}</p>
                      </div>
                    </div>

                    {/* Right: Image */}
                    <Image
                      src={t.image}
                      alt={t.name}
                      width={60}
                      height={60}
                      className="rounded-full object-cover flex-shrink-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
