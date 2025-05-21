import Link from "next/link"
import { MainNav } from "@/components/main-nav"
// import { MobileNav } from "@/components/mobile-nav"
// import { AuthNav } from "./auth-nav"
import Image from "next/image"
import logo from "@/public/images/gold_logo_horizontal.svg";
// import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center">

        {/* Left: Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image className="ml-8" src={logo} alt="Game Of Creators Logo" width={120} height={120} />
        </Link>

        {/* Center: Brands & Creators */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2">
          <MainNav />
        </div>

        {/* Right: Auth options */}
        <div className="flex items-center space-x-4">
          {/* <AuthNav />
          <MobileNav /> */}
        </div>
      </div>
    </header>
  )
}

