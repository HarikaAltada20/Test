"use client"

import Link from "next/link"
import Image from "next/image"
import logo from "@/public/images/GoViral_transparent_logo.png"

export function Footer() {
    return (
        <footer className="w-full py-6 bg-gray-900 text-gray-300">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Image src={logo} alt="Game Of Creators Logo" width={80} height={80} />
                        </div>
                        <p className="text-sm">
                            The ultimate platform connecting brands with creators for authentic marketing campaigns.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white mb-4">For Brands</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/brands" className="hover:text-primary transition-colors">
                                    How it Works
                                </Link>
                            </li>
                            <li>
                                <Link href="/brands#pricing" className="hover:text-primary transition-colors">
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link href="/brands#success-stories" className="hover:text-primary transition-colors">
                                    Success Stories
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white mb-4">For Creators</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/creators" className="hover:text-primary transition-colors">
                                    Apply as Creator
                                </Link>
                            </li>
                            <li>
                                <Link href="/dashboard/opportunities" className="hover:text-primary transition-colors">
                                    Available Contests
                                </Link>
                            </li>
                            <li>
                                <Link href="/creators#guidelines" className="hover:text-primary transition-colors">
                                    Creator Guidelines
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white mb-4">Company</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/about" className="hover:text-primary transition-colors">
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="hover:text-primary transition-colors">
                                    Contact
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms-of-service" className="hover:text-primary transition-colors">
                                    Terms of Service
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
                    <p>© {new Date().getFullYear()} Game Of Creators. All rights reserved.</p>
                </div>
            </div>
        </footer>
    )
} 