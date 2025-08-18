// components/FAQ.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { FaChevronDown } from "react-icons/fa";

const homeFaqs = [
  {
    id: "faq-home-1",
    question: "What is Game of Creators?",
    answer: `<strong>Game of Creators democratizes brand deals</strong> by allowing any creator—even those with zero followers—to participate in contests and earn money based purely on <strong>performance and views</strong>.<br><br><strong>For brands,</strong> this system is a game-changer: a single contest can inspire <strong>hundreds to thousands of creators</strong> to generate viral marketing content for your product. You get <strong>widespread promotion</strong> and a <strong>huge variety of content</strong>, yet you only reward the <strong>best-performing creators</strong>, ensuring you pay just for the most impactful results.`
  },
  {
    id: "faq-home-2",
    question: "Game of Creators is for whom?",
    answer: `<strong>Brands:</strong> Especially B2C Brands looking to promote their products or services.<br><br><strong>Creators:</strong> Content creators of all sizes who are looking to earn brand deals but have struggled due to low followers. Now, performance and views are what matter, not follower count.`
  },
  {
    id: "faq-home-3",
    question: "What are the key features of Game of Creators?",
    answer: `<strong>🎯 Organic Content at Scale:</strong> Generate high-quality, diverse content without manual sourcing<br><br><strong>💰 Only Pay for Top Performing Content:</strong> Pay for content that drives results<br><br><strong>🚀 Creator Outreach Hassle-Free:</strong> Creators come to you<br><br><strong>⚖️ Supply and Demand Platform:</strong> Creators compete, ensuring top ideas rise to the top<br><br><strong>📈 Scale Winners:</strong> Scale top-performing content into paid campaigns<br><br><strong>🌍 Democratized Brand Deals:</strong> Success is based on creativity and performance<br><br><strong>🎨 Creator Freedom of Choice:</strong> Creators choose which brands to work with`
  },
  {
    id: "faq-home-4",
    question: "How does someone participate or sign up for Game of Creators?",
    answer: `<strong>1. Sign up</strong> by registering on the platform and choosing whether you are a <strong>brand</strong> or a <strong>creator</strong>.<br><br><strong>2. For Brands:</strong> Create & launch a contest for viral marketing<br><br><strong>3. For Creators:</strong> Browse available contests, participate, and get paid based on your performance`
  },
  {
    id: "faq-home-5",
    question: "What are the main benefits for participants?",
    answer: `<strong>🎯 Full Control:</strong> Choose which brands to promote<br><br><strong>🔍 Full Transparency:</strong> Access to leaderboard rankings, views, and payment details<br><br><strong>🚀 Performance-Based:</strong> Your followers no longer limit your opportunities—performance and views are what matter`
  },
  {
    id: "faq-home-6",
    question: "How long does the event or contest last?",
    answer: "Contests typically last between 3 to 28 days, depending on the brand's selection."
  },
  {
    id: "faq-home-7",
    question: "What are the prizes or rewards for the winners?",
    answer: `<strong>🏆 Leaderboard-based contests:</strong> Prizes are distributed based on rankings.<br><br><strong>Example:</strong> $1000 prize pool with five winners:<br>• <strong>Rank 1:</strong> $500<br>• <strong>Rank 2:</strong> $250<br>• <strong>Rank 3:</strong> $150<br>• <strong>Rank 4:</strong> $75<br>• <strong>Rank 5:</strong> $25<br><br><strong>📊 CPM-based contests:</strong> Paid based on views, for example, $1 per 1000 views, with minimum and maximum view limits.`
  },
  {
    id: "faq-home-8",
    question: "What kind of support is available to participants?",
    answer: `<strong>Brands provide a complete contest brief</strong> including:<br>• Required resources<br>• Inspirational links<br>• Detailed guidance<br><br><strong>Need help?</strong> You can always reach out for assistance or clarification!`
  },
  {
    id: "faq-home-9",
    question: "What happens if a participant misses a deadline?",
    answer: "Content must be submitted during the live contest period. Submissions must be posted on YouTube or Instagram and linked to the contest within two hours of posting. Late submissions won't be accepted."
  },
  {
    id: "faq-home-10",
    question: "How are participants judged or evaluated?",
    answer: "Judging is based purely on views. Participants must follow the contest's brief, rules, and guidelines to be eligible for payment."
  },
  {
    id: "faq-home-11",
    question: "How can participants track their progress?",
    answer: "Creators can track all their submissions in My submissions section and see their ranking of each contest they participated by visiting that contest leaderboard section."
  },
  {
    id: "faq-home-12",
    question: "Can participants submit multiple entries?",
    answer: "No, participants can only submit one entry per contest."
  },
  {
    id: "faq-home-13",
    question: "Will there be networking opportunities?",
    answer: "Yes, creators can join our community channels and follow us on social media for networking and engagement."
  },
  {
    id: "faq-home-14",
    question: "How are winners or top creators announced?",
    answer: "Winners are announced after the contest ends and after a verification process based on views and rankings."
  }
];
const creatorFaqs = [
  {
    id: "faq-1",
    question: "What is Game of Creators?",
    answer:
      "Game of Creators is the easiest way for creators to get paid for making content for brands—without the hassle of pitching or contracts. Simply join the contests of your choice, compete for cash prizes, and get paid based on your performance and views. Followers are no longer a limitation to earn from brand deals—Game of Creators is democratizing brand deals for creators like you.",
  },
  {
    id: "faq-2",
    question: "How do I make money on Game of Creators?",
    answer:
      "Participate in contests by posting content on your social media. Compete for organic views, and the top performers will win cash prizes.<br><br><strong>Leaderboard contests:</strong> Your ranking matters based on your views.<br><br><strong>CPM contests:</strong> Your views determine your earnings, regardless of your rank.",
  },
  {
    id: "faq-3",
    question: "Do you have paid opportunities for my specific niche?",
    answer:
      "Yes! Game of Creators offers a wide range of contests across various niches, including health & fitness, fashion, gaming, finance, and more. Whatever your niche, there's an opportunity for you to participate!",
  },
  {
    id: "faq-4",
    question: "How much money can I make?",
    answer:
      "Earnings vary by opportunity. Some creators make hundreds to thousands of dollars per contest or deal. The more you create, the more you can earn—there's no limit to how much you can make!",
  },
  {
    id: "faq-5",
    question: "How do I get paid?",
    answer:
      "You can choose how you want to receive your earnings: <strong>Crypto, Bank Transfer, or UPI</strong>. It's your choice!",
  },
  {
    id: "faq-6",
    question: "Is Game of Creators free to use?",
    answer:
      "Yes! Game of Creators is completely free to join and participate in. There are no hidden fees or upfront costs.",
  },
  {
    id: "faq-7",
    question: "How do I get started?",
    answer:
      "Simply register as a creator, browse the available opportunities, and participate in the contest that resonates with you. If you win, you get paid based on your performance!",
  },
  {
    id: "faq-8",
    question: "Can I participate in multiple contests at once?",
    answer:
      "Yes, you can participate in as many contests as you like. Each contest will have its own set of rules and guidelines, so make sure to review them before submitting your content.",
  },
  {
    id: "faq-9",
    question: "What types of content can I submit?",
    answer:
      "The type of content you submit depends on the contest you're participating in. Brands provide a brief and guidelines for each contest, which will specify the type of content required. Be sure to follow those instructions to ensure your submission is eligible.",
  },
  {
    id: "faq-10",
    question: "What happens if my content is rejected?",
    answer:
      "If your content is rejected, you will not be eligible for payment. Rejection happens only when you miss contest rules or miss community guidelines.",
  },
  {
    id: "faq-11",
    question: "Do I need any special equipment to participate?",
    answer:
      "No special equipment is required to participate, but high-quality content tends to perform better. Ensure your videos are clear, engaging, and aligned with the contest brief.",
  },
  {
    id: "faq-12",
    question: "How do I know if I've won?",
    answer:
      "After the contest ends, winners will be announced based on their views and performance. You can track your progress through the leaderboard, and if you're a winner, you will receive your payout according to the contest's structure.",
  },
  {
    id: "faq-13",
    question: "What if I miss the contest submission deadline?",
    answer:
      "Late submissions are not accepted. Ensure you submit your content within the contest's live period and submit your link to the contest page within two hours of posting on YouTube or Instagram.",
  },
  {
    id: "faq-14",
    question: "How are views counted for CPM contests?",
    answer:
      "In CPM-based contests, views are tracked directly from your organic YouTube or Instagram posts. You earn money based on how many views your content receives and based on min max views criteria, regardless of ranking.",
  },
];
const brandFaqs = [
  {
    id: "faq-brand-1",
    question: "What are contests? And How does it work?",
    answer:
      "There are <strong>two types of contests</strong> on Game of Creators: <strong>Leaderboard</strong> and <strong>CPM-based contests</strong>. These contests allow brands to crowdsource a large volume of creator content quickly by launching a competitive campaign.<br><br><strong>How it works:</strong><br>• You set a total prize pool, define your brief and rules<br>• Creators submit videos posted organically on their own YouTube or Instagram accounts<br>• At the end of the contest (typically lasting 3-28 days, set by you), creators with the most views win and split the prize money based on your payout structure<br>• Plus, you own all the winning content, giving you a library of performance-tested videos for paid ads<br><br>It's the fastest way to test multiple hooks, formats, and creators all at once and get viral marketing with hundreds of creators.",
  },
  {
    id: "faq-brand-2",
    question: "How are the contest payouts/prizes structured?",
    answer:
      "You have <strong>full control</strong> over how the prize pool is distributed among winners. Prizes are awarded based on organic views, and you can structure payouts to align with your campaign goals.<br><br><strong>Example:</strong> On a $1,000 contest, you could have 10 winners at $100 each, or 40 winners with this prize distribution:<br><br>• <strong>1st Place:</strong> $300 (A strong, attractive top prize)<br>• <strong>2nd Place:</strong> $150<br>• <strong>3rd Place:</strong> $75<br>• <strong>4th-10th Place</strong> (7 winners): $25 each ($175 total)<br>• <strong>11th-40th Place</strong> (30 winners): $10 each ($300 total)<br><br>The prize pool and distribution are set before your contest goes live, ensuring clarity and consistency in payouts.",
  },
  {
    id: "faq-brand-3",
    question: "What if my contest gets no views?",
    answer:
      "Game of Creators operates on a <strong>supply-and-demand model</strong>, ensuring that your contest won't go unnoticed. With a large network of eager creators, there's always someone ready to compete for your prize pool.<br><br>The prize pool creates an incentive for submissions, which generate views as creators post organically to their audiences. If engagement is lower than expected, we are here to help refine your brief or strategy to maximize participation and results.",
  },
  {
    id: "faq-brand-4",
    question: "How much should I run a contest for?",
    answer:
      "The ideal budget depends on your campaign goals:<br><br><strong>Optimizing for Paid Ads:</strong> Allocate more winners with smaller prizes for a diverse range of content.<br><br><strong>Maximizing Organic Reach:</strong> Offer fewer but larger payouts to attract top-tier creators for viral, organic reach.<br><br>We recommend starting with at least <strong>$1,000</strong>, but contests can begin with as little as <strong>$50</strong>. There is no upper limit.",
  },
  {
    id: "faq-brand-5",
    question: "How do I track conversions?",
    answer:
      "To track conversions effectively, Game of Creators tracks views and engagement on the organic content posted by influencers:<br><br><strong>View and Engagement Metrics:</strong> After the contest launches, creators post content on their Instagram or YouTube accounts. You can track the views, likes, shares, and other engagement metrics to evaluate each post's performance.<br><br><strong>Custom Call-to-Actions (CTAs):</strong> You can require creators to include a CTA in their content, such as visiting your website or downloading your app, making it easier to connect content performance with measurable outcomes.",
  },
  {
    id: "faq-brand-6",
    question: "Do I own the winning content?",
    answer:
      "<strong>Yes, you own the winning content outright and forever.</strong> This means you have full rights to repost, edit, or use it across any platform, including in paid ads.",
  },
  {
    id: "faq-brand-7",
    question: "How can Game of Creators help me find content-market fit?",
    answer:
      "By running a contest, you gain access to diverse content from creators, helping you quickly identify which content formats resonate with your audience. You'll also discover top-performing creators who can become long-term partners.<br><br>Game of Creators accelerates your path to content-market fit by streamlining testing, learning, and scaling what works for your brand.",
  },
  {
    id: "faq-brand-8",
    question: "How do I know views are real?",
    answer:
      "Game of Creators is a <strong>YouTube and Instagram-approved platform</strong>, with access to their APIs. This ensures all views and engagement metrics come directly from verified data, providing accurate and trustworthy analytics.<br><br>Any creator attempting to manipulate metrics will be removed from the platform, ensuring transparency and quality results for your campaigns.",
  },
  {
    id: "faq-brand-9",
    question: "Where will the videos be posted?",
    answer:
      "Videos will be posted directly on the creators' <strong>organic YouTube and Instagram accounts</strong>, ensuring they reach genuine audiences in an authentic way. This approach maximizes exposure and leverages the creators' established following for better results.",
  },
  {
    id: "faq-brand-10",
    question: "How are creators paid?",
    answer:
      "Game of Creators handles all creator payments seamlessly for you. Once the contest ends and winners are determined based on organic views, we distribute the prize money directly to the winning creators' wallets.<br><br>From there, they can request a withdrawal at any time through their preferred payment method—<strong>Crypto, Bank Transfer, or UPI</strong>. The only condition is that the payout must be at least <strong>$20</strong>.<br><br>This ensures a smooth process, so you don't have to worry about managing individual payments or logistics.",
  },
];

const pricingFaqs = [
  {
    question: "How are the creator payouts / prizes structured?",
    answer:
      "You control how the prize pool is split. For example: 3 winners: $500 / $300 / $200, or 5 winners: $400 / $250 / $150 / $100 / $100. You define this upfront in your contest brief, and creators compete to win based on real engagement.",
  },
  {
    question: "What if my contest gets no views?",
    answer:
      "Creators are incentivized to promote their content because views = prizes. This means they actively push their posts to friends, followers, and beyond to maximize reach. It's like having a motivated marketing team built in. If results fall short, we can help you optimize your brief or strategy for next time—at no extra cost.",
  },
  {
    question: "How many creators are on Game Of Creators?",
    answer:
      "We have a fast-growing network of 5,000+ active creators across various niches. When you launch a contest, it goes live to all eligible creators through our dashboard and email system—ensuring visibility and participation.",
  },
  {
    question: "How much should I run a contest for?",
    answer:
      "It depends on your goal: $1,000–$2,000 for a range of quality UGC entries, $500+ for niche campaigns or specific messaging, higher payouts attract creators with larger audiences. We'll help you structure it based on your goals—whether that's more entries, more reach, or better-quality content.",
  },
  {
    question: "Do I own the content?",
    answer:
      "Yes, once a contest ends and winners are announced, you get full rights to download and repurpose all winning content for your brand's marketing use—including ads, social posts, website use, etc. Non-winning content may still be available upon request or with creator permission, depending on your use case.",
  },
  {
    question: "How do you help me find my content-market fit?",
    answer:
      "We help you test different content styles and creator personalities to see what resonates with your audience. This process of testing various approaches helps you discover the most effective way to present your product or service to your target market.",
  },
  {
    question: "How do I know the views are real?",
    answer:
      "All content links are public, and we provide platform-specific analytics that you can verify. You can see actual engagement metrics from the platforms where the content is posted.",
  },
  {
    question: "What type of creators are on the platform?",
    answer:
      "Our platform hosts a diverse range of creators across different niches including lifestyle, tech, beauty, fitness, food, gaming, and more. We have creators with followings ranging from micro-influencers to those with larger audiences, ensuring you can find the perfect match for your brand's voice and target audience.",
  },
  {
    question: "How long does a typical contest run?",
    answer:
      "Most contests run for 7-14 days, which gives creators enough time to develop quality content while maintaining momentum and excitement. However, you have flexibility to set shorter or longer timeframes depending on your specific goals and campaign urgency.",
  },
  {
    question: "Can I run multiple contests simultaneously?",
    answer:
      "Yes! Depending on your subscription plan, you can run multiple contests at the same time. This is perfect for testing different content approaches, targeting various audience segments, or launching campaigns across multiple products simultaneously.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);
  const faqHeaderRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // const faqs = pathname.includes("brands") ? brandFaqs : creatorFaqs;

  const faqs =
    pathname === "/pricing"
      ? pricingFaqs
      : pathname.includes("brands")
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
        <Users className="text-white h-5 w-5" />
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
          <div key={index} className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFAQ(index)}
              className={`w-full flex justify-between items-center px-6 py-6 
                ${
                  pathname.includes("brands") || pathname === "/pricing" || pathname === "/"
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
              <div
                className="text-left text-md  md:text-lg pt-4 px-4 pb-4 text-gray-400 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: faq.answer }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
  );
}
