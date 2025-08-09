import Image from "next/image";
import { Quote, MessageSquareQuote } from "lucide-react";
export default function Testimonials() {
  const testimonials = [
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
      image: ",/images/Ellipse 2355 (2).png",
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
      image: "/images/olivia.jpg",
      quote:
        "This community is amazing — full of supportive and inspiring people.",
    },
  ];

  const rows = [];
  for (let i = 0; i < testimonials.length; i += 4) {
    rows.push(testimonials.slice(i, i + 4));
  }

  return (
    <section className="text-white py-20 px-6">
      {/* Heading */}
      <div className="text-center max-w-3xl mx-auto">
        <button className="bg-[#1E233E] text-white py-1 px-4 rounded-full mb-7">
          ✨ Our Brands
        </button>
        <h2 className="text-3xl md:text-5xl font-bold mb-7">
          What{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
            }}
          >
            Creators
          </span>{" "}
          Say About Us
        </h2>
        <p className="text-xl text-gray-300">
          "Creators love our platform for its user-friendly interface, diverse
          opportunities, and responsive community support."
        </p>
      </div>

      {/* Rows */}
      <div className="mt-12 space-y-8">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="overflow-hidden relative">
            <div className="flex justify-center gap-6">
              {row.map((t, i) => (
                <div
                  key={i}
                  className={`p-8 rounded-xl border border-gray-700 flex-shrink-0 
               ${i === 0 || i === 3 ? "w-[500px]" : "w-[500px]"}`}
                  style={{
                    transform:
                      i === 0
                        ? "translateX(-1%)"
                        : i === 3
                        ? "translateX(1%)"
                        : "translateX(0)",
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Quote + Name + Role */}
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2">
                        {/* Image with orange shade background */}
                        <div className="relative w-8 h-8 flex-shrink-0">
                          {/* Orange shade background */}
                          <div
                            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 
                                  w-16 h-16 rounded-full blur-lg opacity-30 pointer-events-none"
                            style={{ backgroundColor: "#FF652D" }}
                          ></div>

                          {/* Icon image */}
                          <Image
                            src="./images/Frame 2147207526.png" // replace with your image path
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
