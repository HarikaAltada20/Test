import { useEffect, useState, useRef } from "react";

interface NumbersSectionProps {
  items: {
    numbers: (number | string)[];
    label: string;
    suffix?: string;
  }[];
}

export default function NumbersSection({ items }: NumbersSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [animate, setAnimate] = useState(false);

  const maxSteps = Math.max(...items.map((item) => item.numbers.length)) - 1;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setAnimate(true);
        }
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (animate && step < maxSteps) {
      const timeout = setTimeout(() => {
        setStep((prev) => prev + 1);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [animate, step, maxSteps]);

  return (
    <section className="py-16" ref={sectionRef}>
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex justify-center items-center text-white text-center gap-4 sm:gap-8 overflow-x-auto">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <NumberBlock
                numbers={item.numbers}
                step={step}
                label={item.label}
                suffix={item.suffix}
              />
              {idx < items.length - 1 && <Divider />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NumberBlock({
  numbers,
  step,
  label,
  suffix = "",
}: {
  numbers: (number | string)[];
  step: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center px-2 sm:px-8">
      <div className="flex items-center">
        <div className="overflow-hidden h-[48px] sm:h-[72px]">
          <div
            className="flex flex-col transition-transform duration-300 ease-in-out"
            style={{
              transform: `translateY(-${
                Math.min(step, numbers.length - 1) *
                (typeof window !== "undefined" && window.innerWidth < 640
                  ? 48
                  : 72)
              }px)`,
            }}
          >
            {numbers.map((num, i) => (
              <div
                key={i}
                className="flex items-center text-3xl sm:text-6xl font-semibold h-[48px] sm:h-[72px]"
              >
                {num}
                {suffix}
              </div>
            ))}
          </div>
        </div>
        <span className="text-orange-600 font-bold text-3xl sm:text-6xl ml-1">
          +
        </span>
      </div>
      <p className="mt-2 text-xs sm:text-base">{label}</p>
    </div>
  );
}

function Divider() {
  return (
    <div className="border-l-2 border border-gray-500 h-12 sm:h-20"></div>
  );
}
