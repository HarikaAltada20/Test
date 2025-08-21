"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
  ArrowUp,
} from "lucide-react";
import logo from "@/public/images/gold_logo_horizontal.svg";

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative w-full bg-[#000825] text-white py-10 px-8 overflow-hidden">
      <div className="relative max-w-[1250px] pt-20 mx-auto flex flex-nowrap max-[700px]:flex-wrap justify-between gap-16  max-[1000px]:gap-16 max-[1180px]:gap-8">
        {/* Logo & Description */}
        <div className="flex flex-col max-w-xl space-y-6">
          <Link href="/" className="inline-block">
            <div className="h-150">
              <Image
                src={logo}
                alt="Game Of Creators Logo"
                width={100}
                height={50}
                className="w-[200px] h-[70px] max-w-full max-h-full transition-all duration-300 group-hover:brightness-110"
              />
            </div>
          </Link>
          <p className="text-lg text-gray-300 max-w-[350px]">
            The ultimate platform connecting brands with creators for authentic,
            viral marketing campaigns that drive real results.
          </p>

          {/* Social Icons */}
          <div className="flex space-x-4 text-gray-300">
            {[
              {
                icon: Twitter,
                href: "https://x.com/gameofcreators",
                hoverColor: "hover:text-blue-400 hover:shadow-blue-400/20",
              },
              {
                icon: Instagram,
                href: "https://www.instagram.com/try_gameofcreators/",
                hoverColor: "hover:text-pink-400 hover:shadow-pink-400/20",
              },
              {
                icon: Linkedin,
                href: "https://www.linkedin.com/company/game-of-creators/about/",
                hoverColor: "hover:text-blue-500 hover:shadow-blue-500/20",
              },
              {
                icon: Youtube,
                href: "https://www.youtube.com/@gameofcreators",
                hoverColor: "hover:text-red-400 hover:shadow-red-400/20",
              },
            ].map(({ icon: Icon, href, hoverColor }, idx) => (
              <Link
                key={idx}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-3 rounded-full bg-[#161C34] border border-gray-700 text-gray-400 transition-all duration-300 ${hoverColor}`}
                aria-label={`Link to ${href}`}
              >
                <Icon className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation Sections */}
        <div
          className="  flex text-lg text-gray-300
    gap-16
    max-[1180px]:gap-8
    max-[1000px]:flex-wrap max-[1000px]:gap-16"
        >
          {/* For Brands */}
          <nav>
            <h3 className="font-semibold text-xl mb-6 text-white">
              For Brands
            </h3>
            <ul className="space-y-3">
              {[
                { name: "How it Works", href: "/brands" },
                { name: "Pricing", href: "/pricing" },
                // { name: "Success Stories", href: "#" },
              ].map(({ name, href }, idx) => (
                <li key={idx}>
                  <Link
                    href={href}
                    className="hover:underline hover:text-white transition-colors duration-200"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* For Creators */}
          <nav>
            <h3 className="font-semibold text-xl mb-6 text-white">
              For Creators
            </h3>
            <ul className="space-y-3">
              {[
                { name: "Join as Creator", href: "/creators" },
                // {
                //   name: "Find Opportunities",
                //   href: "/dashboard/opportunities",
                // },
                // { name: "Creator Guidelines", href: "#" },
              ].map(({ name, href }, idx) => (
                <li key={idx}>
                  <Link
                    href={href}
                    className="hover:underline hover:text-white transition-colors duration-200"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav>
            <h3 className="font-semibold text-xl mb-6 text-white">Company</h3>
            <ul className="space-y-3">
              {[
                { name: "About Us", href: "/about" },
                { name: "Contact", href: "/contact" },
                { name: "Privacy Policy", href: "/privacy-policy" },
                { name: "Terms of Service", href: "/terms-of-service" },
              ].map(({ name, href }, idx) => (
                <li key={idx}>
                  <Link
                    href={href}
                    className="hover:underline hover:text-white transition-colors duration-200"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Information */}
          <div className="max-w-xs space-y-4 text-gray-300 text-lg">
            <h3 className="font-semibold text-xl mb-6 text-white">
              Contact Information
            </h3>
            <ul className="space-y-4">
              <li className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-[#FDC155]" />
                <span>support@gameofcreators.com</span>
              </li>
              {/* <li className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-[#FDC155]" />
                <span>+1 (555) 123-4567</span>
              </li> */}
              <li className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-[#FDC155]" />
                <span>San Francisco, CA</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr className="border-gray-700 my-10 max-w-[1250px] mx-auto" />

      {/* Bottom Section */}
      <div className="max-w-[1250px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 px-4 sm:px-6 md:px-8 text-center md:text-left">
        <p className="text-sm text-gray-400">
          © {new Date().getFullYear()} Game Of Creators. All rights reserved.
        </p>
        <button
          onClick={scrollToTop}
          className="flex relative items-center gap-2 overflow-hidden bg-gradient-to-r from-[#7B40EC] to-[#A351D8] px-6 py-2 rounded-full text-white hover:scale-105 transition-transform duration-300"
          aria-label="Back to top"
        >
          <div className="scan-line"></div>
          Back to Top
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
    </footer>
  );
}
