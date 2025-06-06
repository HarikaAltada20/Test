"use client"

import Link from "next/link"
import Image from "next/image"
import { Twitter, Linkedin, Instagram, Youtube, Mail, Phone, MapPin, ArrowUp } from "lucide-react"
import logo from "@/public/images/gold_logo_horizontal.svg";

export function Footer() {
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer className="relative w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-purple-500/5 to-blue-500/5"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(236,72,153,0.1),transparent)] opacity-70"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.1),transparent)] opacity-70"></div>

            {/* Top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"></div>

            <div className="relative container px-6 md:px-8 mx-auto">
                {/* Main footer content */}
                <div className="py-16 lg:py-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
                        {/* Brand section */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="group">
                                <Link href="/" className="inline-block">
                                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600/30 backdrop-blur-sm hover:from-slate-700/60 hover:to-slate-600/40 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-rose-500/10">
                                        <Image
                                            src={logo}
                                            alt="Game Of Creators Logo"
                                            width={140}
                                            height={40}
                                            className="transition-all duration-300 group-hover:brightness-110"
                                        />
                                    </div>
                                </Link>
                            </div>
                            <p className="text-slate-300 leading-relaxed text-sm max-w-sm">
                                The ultimate platform connecting brands with creators for authentic, viral marketing campaigns that drive real results.
                            </p>

                            {/* Social links */}
                            <div className="flex gap-3">
                                {[
                                    { icon: Twitter, href: "#", color: "hover:text-blue-400 hover:shadow-blue-400/20" },
                                    { icon: Instagram, href: "#", color: "hover:text-pink-400 hover:shadow-pink-400/20" },
                                    { icon: Linkedin, href: "#", color: "hover:text-blue-500 hover:shadow-blue-500/20" },
                                    { icon: Youtube, href: "#", color: "hover:text-red-400 hover:shadow-red-400/20" }
                                ].map(({ icon: Icon, href, color }, index) => (
                                    <Link
                                        key={index}
                                        href={href}
                                        className={`group p-3 rounded-xl bg-slate-800/50 border border-slate-600/30 text-slate-400 transition-all duration-300 hover:bg-slate-700/60 hover:border-slate-500/50 hover:scale-110 hover:shadow-lg ${color}`}
                                    >
                                        <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* For Brands */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
                                For Brands
                            </h3>
                            <ul className="space-y-4">
                                {[
                                    { name: "How it Works", href: "/brands" },
                                    { name: "Pricing", href: "/brands#pricing" },
                                    { name: "Success Stories", href: "/brands#success-stories" },
                                    { name: "Case Studies", href: "/case-studies" },
                                    { name: "ROI Calculator", href: "/roi-calculator" }
                                ].map((link, index) => (
                                    <li key={index}>
                                        <Link
                                            href={link.href}
                                            className="group inline-flex items-center text-sm text-slate-300 hover:text-white transition-all duration-300 hover:translate-x-1"
                                        >
                                            <span className="relative">
                                                {link.name}
                                                <span className="absolute bottom-0 left-0 w-0 h-px bg-gradient-to-r from-rose-400 to-pink-400 transition-all duration-300 group-hover:w-full"></span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* For Creators */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                For Creators
                            </h3>
                            <ul className="space-y-4">
                                {[
                                    { name: "Apply as Creator", href: "/creators" },
                                    { name: "Available Contests", href: "/dashboard/opportunities" },
                                    { name: "Creator Guidelines", href: "/creators#guidelines" },
                                    { name: "Success Tips", href: "/creator-tips" },
                                    { name: "Community", href: "/community" }
                                ].map((link, index) => (
                                    <li key={index}>
                                        <Link
                                            href={link.href}
                                            className="group inline-flex items-center text-sm text-slate-300 hover:text-white transition-all duration-300 hover:translate-x-1"
                                        >
                                            <span className="relative">
                                                {link.name}
                                                <span className="absolute bottom-0 left-0 w-0 h-px bg-gradient-to-r from-purple-400 to-blue-400 transition-all duration-300 group-hover:w-full"></span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Company & Contact */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                Company
                            </h3>
                            <ul className="space-y-4">
                                {[
                                    { name: "About Us", href: "/about" },
                                    { name: "Contact", href: "/contact" },
                                    { name: "Privacy Policy", href: "/privacy-policy" },
                                    { name: "Terms of Service", href: "/terms-of-service" },
                                    { name: "Careers", href: "/careers" }
                                ].map((link, index) => (
                                    <li key={index}>
                                        <Link
                                            href={link.href}
                                            className="group inline-flex items-center text-sm text-slate-300 hover:text-white transition-all duration-300 hover:translate-x-1"
                                        >
                                            <span className="relative">
                                                {link.name}
                                                <span className="absolute bottom-0 left-0 w-0 h-px bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-300 group-hover:w-full"></span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            {/* Contact info */}
                            <div className="space-y-3 pt-4 border-t border-slate-700/50">
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-600/30">
                                        <Mail className="h-3 w-3" />
                                    </div>
                                    <span>hello@gameofcreators.com</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-600/30">
                                        <Phone className="h-3 w-3" />
                                    </div>
                                    <span>+1 (555) 123-4567</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-600/30">
                                        <MapPin className="h-3 w-3" />
                                    </div>
                                    <span>San Francisco, CA</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Newsletter section */}
                <div className="py-12 border-t border-slate-700/50">
                    <div className="max-w-2xl mx-auto text-center space-y-6">
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                            Stay in the loop
                        </h3>
                        <p className="text-slate-300 text-lg">
                            Get the latest insights, tips, and updates delivered to your inbox
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/30 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all duration-300"
                            />
                            <button className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-medium rounded-xl hover:from-rose-600 hover:to-pink-600 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-rose-500/25">
                                Subscribe
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom section */}
                <div className="py-8 border-t border-slate-700/50">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <p className="text-sm text-slate-400">
                                © {new Date().getFullYear()} Game Of Creators. All rights reserved.
                            </p>
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-500">Made with</span>
                                <div className="w-4 h-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-slate-500">in San Francisco</span>
                            </div>
                        </div>

                        {/* Back to top button */}
                        <button
                            onClick={scrollToTop}
                            className="group flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-600/30 text-slate-400 text-sm rounded-xl hover:bg-slate-700/60 hover:text-white hover:border-slate-500/50 transition-all duration-300 hover:scale-105"
                        >
                            <span>Back to top</span>
                            <ArrowUp className="h-3 w-3 transition-transform duration-300 group-hover:-translate-y-1" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom gradient line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
        </footer>
    )
} 