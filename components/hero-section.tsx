import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import socialPairIcon from "@/public/images/social_pair.png"; // Import the social_pair.svg
import { ArrowRight, ChevronDown } from "lucide-react";

// Helper component for Creator Avatars
const AvatarCircle = ({ src, alt }: { src: string, alt: string }) => (
  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-slate-700 -ml-3 first:ml-0 bg-slate-600 flex-shrink-0 shadow-md">
    <Image src={src} alt={alt} width={44} height={44} className="object-cover w-full h-full" />
  </div>
);

export function HeroSection() {
  return (
    // Main container for the hero section
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0F11] text-slate-100 py-12 sm:py-20 px-4">
      {/* Social Icons Row - Using the provided social_pair.svg */}
      <div className="mb-8 sm:mb-10">
        <Image
          src={socialPairIcon}
          alt="Social Media Icons"
          width={113} // Intrinsic width from SVG
          height={68} // Intrinsic height from SVG
          priority
        />
      </div>

      {/* Main Text Content */}
      <div className="text-center space-y-6 sm:space-y-8 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
          Make your <span className="text-blue-400">product</span>
          <br />
          go viral
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-xl mx-auto">
          Launch creator contests and make your product viral with guranteed results.
        </p>
      </div>

      {/* Buttons Row */}
      <div className="flex flex-col sm:flex-row gap-4 mt-10 sm:mt-12">
        <Link href="/brands" passHref>
          <Button
            size="lg"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 text-base sm:text-lg w-full sm:w-auto rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105"
          >
            I'm a Brand
          </Button>
        </Link>
        <Link href="/creators" passHref>
          <Button
            size="lg"
            variant="outline"
            className="border-slate-600 bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 font-semibold px-8 py-3 text-base sm:text-lg w-full sm:w-auto rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105"
          >
            I'm a Creator
          </Button>
        </Link>
      </div>

      {/* Image Gallery Section - Now a sibling to the hero section */}
      <section className="w-full pb-12 md:pb-24 lg:pb-32 bg-[#0B0F11] mt-12">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="aspect-[4/3] sm:aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                <Image
                  src={`/placeholder-gallery-${item}.jpg`} // REPLACE with actual image path
                  alt={`Gallery image ${item}`}
                  width={400}
                  height={300}
                  className="w-full h-full object-cover transition-transform hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">How Game Of Creators Works</h2>
              <p className="max-w-[700px] text-slate-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mx-auto">
                Simple steps to launch your influencer marketing campaign and see results.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "CREATE A CONTEST", description: "Set up your campaign details, budget, and requirements for creators.", iconPlaceholder: "Icon1" },
              { title: "REVIEW APPLICATIONS", description: "Creators apply to your contest, and you select the best matches for your brand.", iconPlaceholder: "Icon2" },
              { title: "TRACK RESULTS", description: "Monitor campaign performance and engagement metrics in real-time.", iconPlaceholder: "Icon3" },
            ].map((step, index) => (
              <div key={index} className="bg-slate-800 p-6 rounded-lg flex flex-col items-center text-center space-y-4 border border-slate-700 hover:border-blue-500 transition-colors group">
                <div className="p-4 rounded-full bg-slate-700 text-blue-400 mb-3 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  {/* REPLACE with actual SVG icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L2 7 L12 12 L22 7 L12 2 Z"></path><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                </div>
                <h3 className="text-xl font-bold text-white">{step.title}</h3>
                <p className="text-slate-300 text-sm flex-grow">{step.description}</p>
                <ArrowRight className="h-5 w-5 text-blue-400 mt-4 group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Game Of Creators Section */}
      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">Why Choose Game Of Creators</h2>
              <p className="max-w-[700px] text-slate-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mx-auto">
                Our platform is engineered for impactful collaborations and authentic engagement.
              </p>
            </div>
          </div>
          <div className="grid gap-12 lg:grid-cols-12 items-stretch">
            {/* Left Column: Large Image */}
            <div className="lg:col-span-5 flex justify-center items-center bg-slate-800 p-6 rounded-lg border border-slate-700">
              <Image
                src="/placeholder-feature-main.jpg" // REPLACE with actual image path
                alt="Feature highlight - e.g., Diverse creators"
                width={450}
                height={600}
                className="rounded-md object-contain max-h-[500px]"
              />
            </div>

            {/* Right Column: Features Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: "Authentic Content", description: "Generate genuine content that resonates with your audience.", icon: "IconAuthentic" },
                { title: "Performance Tracking", description: "Real-time insights into your campaign's success.", icon: "IconTracking" },
                { title: "Easy Management", description: "Intuitive dashboard to manage all campaigns seamlessly.", icon: "IconManagement" },
                { title: "Targeted Reach", description: "Connect with creators whose audiences match your ideal customer.", icon: "IconReach" },
              ].map(item => (
                <div key={item.title} className="bg-slate-800 p-6 rounded-lg space-y-3 border border-slate-700 flex flex-col">
                  <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-blue-400 mb-3">
                    {/* REPLACE with actual SVG icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  <p className="text-slate-300 text-sm flex-grow">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Second row for Why Choose - Cost Effective, Laptop, Dedicated Support */}
          <div className="mt-12 grid md:grid-cols-3 gap-8 items-center">
            <div className="bg-slate-800 p-6 rounded-lg space-y-3 border border-slate-700 text-center md:text-left flex flex-col items-center md:items-start">
              <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-blue-400 mb-3">
                {/* REPLACE with actual SVG icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-white">Cost Effective</h3>
              <p className="text-slate-300 text-sm">Realize your marketing goals without overspending. Transparent pricing and measurable ROI.</p>
            </div>
            <div className="flex justify-center items-center bg-slate-800 p-6 rounded-lg border border-slate-700 min-h-[200px] md:min-h-full">
              <Image
                src="/placeholder-laptop-dashboard.jpg" // REPLACE with actual image path
                alt="Laptop showing dashboard"
                width={300}
                height={200}
                className="rounded-md object-contain"
              />
            </div>
            <div className="bg-slate-800 p-6 rounded-lg space-y-3 border border-slate-700 text-center md:text-left flex flex-col items-center md:items-start">
              <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-blue-400 mb-3">
                {/* REPLACE with actual SVG icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
              </div>
              <h3 className="text-xl font-bold text-white">Dedicated Support</h3>
              <p className="text-slate-300 text-sm">Our expert team is here to assist you every step of the way, ensuring your success.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-slate-800/50"> {/* Slightly different bg for separation */}
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-blue-400">3000+</h3>
              <p className="text-slate-300 uppercase tracking-wider text-sm mt-2">Campaigns Launched</p>
            </div>
            <div>
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-blue-400">100+</h3>
              <p className="text-slate-300 uppercase tracking-wider text-sm mt-2">Categories</p>
            </div>
            <div>
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-blue-400">80M+</h3>
              <p className="text-slate-300 uppercase tracking-wider text-sm mt-2">Impressions Reached</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6 mx-auto max-w-3xl">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">FAQ</h2>
            <p className="text-slate-300 md:text-xl">Your questions, our answers.</p>
          </div>
          <div className="space-y-5">
            {[
              { q: "What is Game Of Creators?", a: "Game Of Creators is a platform that connects brands with creators to launch viral marketing campaigns through contests and collaborations." },
              { q: "How does the pricing work?", a: "Our pricing is based on the scope of your campaign and the creators you choose. We offer transparent packages with no hidden fees." },
              { q: "Can I choose the creators for my campaign?", a: "Yes, you can review applications from creators and select the ones that best fit your brand and campaign goals." },
              { q: "What kind of support do you offer?", a: "We offer dedicated support from our team of experts to help you with campaign setup, creator selection, and performance tracking." },
              { q: "How is campaign performance tracked?", a: "Our platform provides real-time analytics on engagement, reach, impressions, and other key metrics for your campaigns." },
            ].map((faqItem, index) => (
              <details key={index} className="bg-slate-800 p-5 rounded-lg border border-slate-700 group transition-all duration-300 hover:border-blue-500">
                <summary className="font-semibold text-lg text-white cursor-pointer list-none flex justify-between items-center group-hover:text-blue-400">
                  {faqItem.q}
                  <ChevronDown className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform duration-300 group-open:text-blue-400" />
                </summary>
                <p className="text-slate-300 mt-3 pt-3 border-t border-slate-700/50 text-sm leading-relaxed">{faqItem.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-16 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-6 text-center bg-gradient-to-r from-blue-600 to-indigo-700 p-8 md:p-12 lg:p-16 rounded-xl shadow-2xl">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">
                Ready to Join Game Of Creators?
              </h2>
              <p className="max-w-[600px] text-slate-200 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mx-auto">
                Join thousands of brands and creators already using our platform to achieve viral success.
              </p>
            </div>
            <div className="flex flex-col gap-4 min-[400px]:flex-row sm:gap-6">
              <Link href="/auth/signup" passHref>
                <Button size="lg" className="bg-white text-blue-700 hover:bg-slate-100 px-8 py-3 text-lg font-semibold">
                  Sign Up Now <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/contact-demo" passHref>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-3 text-lg font-semibold">
                  Request a Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div> // Closes the main wrapper div
  );
}
