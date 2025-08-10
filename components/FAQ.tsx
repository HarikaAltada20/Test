// components/FAQ.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { Users } from "lucide-react";

import { FaChevronDown } from "react-icons/fa";

const faqs = [
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

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const [animate, setAnimate] = useState(false);
  const faqHeaderRef = useRef<HTMLDivElement>(null);

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
    <section className="py-16 px-4 mb-10 text-white"  ref={faqHeaderRef}>
      <div className="max-w-5xl mx-auto text-center" >
        {/* Top Tag */}
        <button className="px-5 py-2 bg-[#1A1B35] rounded-full text-lg mb-8 flex items-center justify-center mx-auto gap-2">
          <Users className="text-white h-5 w-5" /> {/* user icon in yellow */}
          <span className="text-gray-300">Have inquiries?</span>
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
                className="w-full flex justify-between items-center px-6 py-6 bg-gradient-to-r from-transparent via-[#ff652d30] to-transparent hover:bg-[#1A1B35] transition-colors"
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
