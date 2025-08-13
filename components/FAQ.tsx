// components/FAQ.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { FaChevronDown } from "react-icons/fa";

const homeFaqs = [
  {
    id: "faq-home-1",
    question: "What makes Game of Creators different from other platforms?",
    answer:
      "We have 50,000+ verified creators across every niche - gaming, lifestyle, tech, fashion, fitness, food, and more. From micro-influencers to mega creators!",
  },
  {
    id: "faq-home-2",
    question: "Do you guarantee results?",
    answer:
      "Yes! We're so confident in our platform that we offer performance guarantees. If your campaign doesn't meet the agreed metrics, we'll refund your investment.",
  },
  {
    id: "faq-home-3",
    question: "How quickly can I launch my first content?",
    answer:
      "You can create and launch your first contest in under 5 minutes! Our streamlined process gets you from idea to viral campaign faster than any competitor.",
  },
  {
    id: "faq-home-4",
    question: "What makes Game of Creators different from other platforms?",
    answer:
      "We're the only platform that gamifies creator marketing with contests, leaderboards, and achievement systems. Plus, we guarantee results or your money back!",
  },
  {
    id: "faq-home-4",
    question: "How do you ensure content quality?",
    answer:
      "We're the only platform that gamifies creator marketing with contests, leaderboards, and achievement systems. Plus, we guarantee results or your money back!",
  },
];
const creatorFaqs = [
  {
    id: "faq-1",
    question: "What platforms do you support for content creation?",
    answer:
      "We support a wide range of platforms including Instagram Reels, YouTube Shorts, as well as long-form videos for YouTube, podcasts, and interviews. Every piece of content is tailored for optimal quality and performance on its intended platform.",
  },
  {
    id: "faq-2",
    question: "How does the contest and collaboration process work?",
    answer:
      "Brands post briefs for their campaigns or contests. Creators can browse these opportunities, submit their content, and get selected based on quality and engagement. Payments and collaborations are managed through our secure platform.",
  },
  {
    id: "faq-3",
    question: "How do I get paid?",
    answer:
      "Payments for winning contests or completing collaborations are processed securely through our platform. You can link your preferred payment method to receive your earnings directly.",
  },
  {
    id: "faq-4",
    question: "Are there any fees to join as a creator?",
    answer:
      "Joining Game Of Creators is completely free for creators. We believe in empowering you to monetize your skills without upfront costs. We may take a small platform fee from brand payments on successful collaborations.",
  },
];
const brandFaqs = [
  {
    id: "faq-brand-1",
    question: "How do I create a contest for creators?",
    answer:
      "Our platform makes it easy. Simply define your campaign brief, set your prize pool, specify the type of content you're looking for (e.g., youtube videos, Instagram Reels), and launch. Creators in our network will then be able to see and participate in your contest.",
  },
  {
    id: "faq-brand-2",
    question: "How do I ensure content quality and brand alignment?",
    answer:
      "You provide a detailed brief outlining your brand guidelines, key messages, and content expectations. You can review submissions and provide feedback before selecting winners. Many brands also use contests to discover creators for longer-term collaborations.",
  },
  {
    id: "faq-brand-3",
    question: "What kind of results can I expect from creator contests?",
    answer:
      "Results vary, but brands typically receive a diverse range of authentic content pieces at a fraction of traditional production costs. This content can be used for social media, ads, and other marketing channels, often leading to increased engagement, brand awareness, and reach.",
  },
  {
    id: "faq-brand-4",
    question: "How are creators paid and how much does it cost?",
    answer:
      "You set the prize pool for your contest. Payments to winning creators are handled securely through our platform. Our pricing is transparent, typically involving a platform fee on top of the prize money you allocate for creators.",
  },
];
export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);
  const faqHeaderRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // const faqs = pathname.includes("brands") ? brandFaqs : creatorFaqs;

  const faqs = pathname.includes("brands")
    ? brandFaqs
    : pathname === "/"
    ? homeFaqs
    : creatorFaqs;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (faqHeaderRef.current) {
      observer.observe(faqHeaderRef.current);
    }

    return () => {
      if (faqHeaderRef.current) {
        observer.unobserve(faqHeaderRef.current);
      }
    };
  }, []);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };
  return (
    <section className="py-16 px-4 mb-10 text-white" ref={faqHeaderRef}>
      <div className="max-w-5xl mx-auto text-center">
        {/* Top Tag */}
        <button className="px-5 py-2 bg-[#2C3247] rounded-full text-lg mb-8 flex items-center justify-center mx-auto gap-2">
          <Users className="text-white h-5 w-5" /> {/* user icon in yellow */}
          <span className="text-white">Have inquiries?</span>
        </button>

        {/* Gradient Title */}
        <h2
          className={`text-3xl md:text-5xl font-bold flex flex-wrap justify-center gap-4 ${
            animate ? "slide-up" : "hide-before-animate"
          }`}
          style={{ animationDelay: "0.2s" }}
        >
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #7F39EC 36.41%, #B16FF4 99.95%)",
            }}
          >
            Frequently
          </span>
          <span className="text-white">Asked</span>
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
            }}
          >
            Questions
          </span>
        </h2>

        <p
          className={`mt-6 mb-10 text-gray-300 md:text-2xl ${
            animate ? "slide-left" : "hide-before-animate"
          }`}
          style={{ animationDelay: "1s" }}
        >
          Here are some frequently asked questions
        </p>

        {/* FAQ List */}
        <div className="mt-10 space-y-7">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className={`w-full flex justify-between items-center px-6 py-6 
    ${
      pathname.includes("brands") || pathname === "/"
        ? "bg-gradient-to-r from-transparent via-transparent to-[#7F39EC50]"
        : "bg-gradient-to-r from-transparent via-transparent to-[#ff652d50]"
    } 
    hover:bg-[#1A1B35] transition-colors`}
              >
                <span className="text-left text-xl">{faq.question}</span>
                <FaChevronDown
                  className={`transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openIndex === index && (
                <div className="text-left text-md pt-4 px-4 pb-4 text-gray-400">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
