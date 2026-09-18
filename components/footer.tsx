"use client";

import Link from "next/link";
import Image from "next/image";
import { Twitter, Instagram, Youtube, Mail, MapPin } from "lucide-react";
import logo from "@/public/images/gold_logo_horizontal.svg";
import logoWhite from "@/public/images/Primary_Logo_white.png";
import { MARKETING_HOME_AS_GUEST } from "@/constants/marketingHome";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";

export function Footer() {
  const { isLight } = useThemeMode();

  return (
    <footer
      className={cn(
        "relative w-full px-4 sm:px-6 lg:px-8 pb-8 pt-4 overflow-hidden transition-colors duration-300",
        isLight
          ? "bg-[#F1F1F1] text-black"
          : "bg-black text-white",
      )}
    >
      <div
        className={cn(
          "relative z-10 max-w-[1200px] mx-auto rounded-[28px] md:rounded-[40px] overflow-hidden px-6 sm:px-10 lg:px-12 pt-12 pb-16 md:pt-14 md:pb-20 border",
          isLight
            ? "bg-white border-black/[0.04] shadow-[0_20px_60px_rgba(80,60,140,0.08)]"
            : "bg-[#141414] border-white/5",
        )}
      >
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-3 space-y-5">
            <Link href={MARKETING_HOME_AS_GUEST} className="inline-block">
              <Image
                src={isLight ? logo : logoWhite}
                alt="Game Of Creators Logo"
                width={160}
                height={40}
                className="w-[150px] h-auto"
              />
            </Link>
            <p
              className={cn(
                "text-sm leading-relaxed max-w-[240px]",
                isLight ? "text-black/50" : "text-zinc-400",
              )}
            >
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
              {!isLight ? (
                <Link
                  href="https://x.com/gameofcreators"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  className="text-white hover:opacity-80 transition-opacity"
                >
                  <Twitter className="h-5 w-5" />
                </Link>
              ) : null}
            </div>
          </div>

          {/* For Brands */}
          <nav className="lg:col-span-2">
            <h3
              className={cn(
                "text-sm mb-4",
                isLight ? "font-semibold text-black" : "font-medium text-zinc-400",
              )}
            >
              For Brands
            </h3>
            <ul
              className={cn(
                "space-y-3 text-sm",
                isLight ? "text-black/55" : "text-zinc-300",
              )}
            >
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
                    className={cn(
                      "transition-colors",
                      isLight ? "hover:text-black" : "hover:text-white",
                    )}
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* For Creators */}
          <nav className="lg:col-span-2">
            <h3
              className={cn(
                "text-sm mb-4",
                isLight ? "font-semibold text-black" : "font-medium text-zinc-400",
              )}
            >
              For Creators
            </h3>
            <ul
              className={cn(
                "space-y-3 text-sm",
                isLight ? "text-black/55" : "text-zinc-300",
              )}
            >
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
                    className={cn(
                      "transition-colors",
                      isLight ? "hover:text-black" : "hover:text-white",
                    )}
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav className="lg:col-span-2">
            <h3
              className={cn(
                "text-sm mb-4",
                isLight ? "font-semibold text-black" : "font-medium text-zinc-400",
              )}
            >
              Company
            </h3>
            <ul
              className={cn(
                "space-y-3 text-sm",
                isLight ? "text-black/55" : "text-zinc-300",
              )}
            >
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
                    className={cn(
                      "transition-colors",
                      isLight ? "hover:text-black" : "hover:text-white",
                    )}
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h3
              className={cn(
                "text-sm mb-4",
                isLight ? "font-semibold text-black" : "font-medium text-zinc-400",
              )}
            >
              Contact Information
            </h3>
            <ul
              className={cn(
                "space-y-4 text-sm",
                isLight ? "text-black/55" : "text-zinc-300",
              )}
            >
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-[#FF6A1A]" />
                <a
                  href="mailto:support@gameofcreators.com"
                  className={cn(
                    "transition-colors break-all",
                    isLight ? "hover:text-black" : "hover:text-white",
                  )}
                >
                  support@gameofcreators.com
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[#FF6A1A]" />
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
          <span
            className={cn(
              "text-[48px] sm:text-[72px] md:text-[96px] lg:text-[112px] font-bold tracking-tight leading-none whitespace-nowrap translate-y-[28%]",
              isLight ? "text-black/[0.06]" : "text-white/[0.04]",
            )}
          >
            GAME OF CREATORS
          </span>
        </div>
      </div>

      <p
        className={cn(
          "relative z-10 mt-6 text-center text-xs sm:text-sm",
          isLight ? "text-black/40" : "text-zinc-500",
        )}
      >
        © {new Date().getFullYear()} Game of Creators. All rights reserved.
      </p>

      {/* Purple shade from the bottom edge (light mode) */}
      {isLight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 sm:h-52"
        >
          <div className="absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(ellipse_at_bottom,rgba(167,139,250,0.45)_0%,rgba(186,155,255,0.22)_35%,transparent_75%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#c4b5fd]/35 via-[#ddd6fe]/15 to-transparent sm:h-28" />
        </div>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 sm:h-36"
        >
          <div className="absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.08)_35%,transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/[0.12] via-white/[0.04] to-transparent sm:h-20" />
        </div>
      )}
    </footer>
  );
}
