"use client";

import Link from "next/link";
import Image from "next/image";
import { Twitter, Instagram, Youtube, Mail, MapPin } from "lucide-react";
import logo from "@/public/images/gold_logo_horizontal.svg";
import { MARKETING_HOME_AS_GUEST } from "@/constants/marketingHome";
import { SOCIAL_LINKS } from "@/constants/socialLinks";

export function Footer() {
  return (
    <footer className="relative w-full bg-black text-white px-4 sm:px-6 lg:px-8 pb-8 pt-4 overflow-hidden">
      <div className="relative max-w-[1200px] mx-auto rounded-[28px] md:rounded-[36px] bg-[#141414] border border-white/5 overflow-hidden px-6 sm:px-10 lg:px-12 pt-12 pb-16 md:pt-14 md:pb-20">
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-3 space-y-5">
            <Link href={MARKETING_HOME_AS_GUEST} className="inline-block">
              <Image
                src={logo}
                alt="Game Of Creators Logo"
                width={160}
                height={40}
                className="w-[150px] h-auto"
              />
            </Link>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-[240px]">
              Performance-based creator marketing for brands and creators
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href="https://www.youtube.com/@gameofcreators"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="text-[#FF0000] hover:opacity-80 transition-opacity"
              >
                <Youtube className="h-5 w-5" />
              </Link>
              <Link
                href="https://www.instagram.com/try_gameofcreators/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-[#E1306C] hover:opacity-80 transition-opacity"
              >
                <Instagram className="h-5 w-5" />
              </Link>
              <Link
                href="https://x.com/gameofcreators"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="text-white hover:opacity-80 transition-opacity"
              >
                <Twitter className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* For Brands */}
          <nav className="lg:col-span-2">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">For Brands</h3>
            <ul className="space-y-3 text-sm text-zinc-300">
              {[
                { name: "How it Works", href: "/brands" },
                { name: "Get Started", href: "/get-started" },
                {
                  name: "Book a Demo",
                  href: "https://calendly.com/guptavishesh2/30min",
                  external: true,
                },
                { name: "FAQ", href: "/#faq" },
              ].map(({ name, href, external }) => (
                <li key={name}>
                  <Link
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="hover:text-white transition-colors"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* For Creators */}
          <nav className="lg:col-span-2">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">
              For Creators
            </h3>
            <ul className="space-y-3 text-sm text-zinc-300">
              {[
                { name: "Join as Creator", href: "/creators" },
                { name: "Why GOC", href: "/creators#why-goc" },
                {
                  name: "Join Community",
                  href: SOCIAL_LINKS.discord,
                  external: true,
                },
              ].map(({ name, href, external }) => (
                <li key={name}>
                  <Link
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="hover:text-white transition-colors"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav className="lg:col-span-2">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Company</h3>
            <ul className="space-y-3 text-sm text-zinc-300">
              {[
                { name: "About Us", href: "/about" },
                { name: "Blogs", href: "/blog" },
                { name: "Contact", href: "/contact" },
                { name: "Privacy Policy", href: "/privacy-policy" },
                { name: "Terms of Service", href: "/terms-of-service" },
                {
                  name: "Jobs",
                  href: "https://www.linkedin.com/in/vishesh-gupta-a34111209/",
                  external: true,
                },
              ].map(({ name, href, external }) => (
                <li key={name}>
                  <Link
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="hover:text-white transition-colors"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">
              Contact Information
            </h3>
            <ul className="space-y-4 text-sm text-zinc-300">
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-zinc-400" />
                <a
                  href="mailto:support@gameofcreators.com"
                  className="hover:text-white transition-colors break-all"
                >
                  support@gameofcreators.com
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-zinc-400" />
                <span>San Francisco, CA</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Watermark */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden select-none"
        >
          <span className="text-[48px] sm:text-[72px] md:text-[96px] lg:text-[112px] font-bold tracking-tight text-white/[0.04] leading-none whitespace-nowrap translate-y-[28%]">
            GAME OF CREATORS
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs sm:text-sm text-zinc-500">
        © {new Date().getFullYear()} Game of Creators. All rights reserved.
      </p>
    </footer>
  );
}
