"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar"
// import { ModeToggle } from "@/components/mode-toggle"
import { Logo } from "./logo"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import logo from "@/public/images/GoViral_transparent_logo.png"
import Image from "next/image"

export function Nav() {
    const { user, signOut } = useAuth()
    const pathname = usePathname()

    // Don't show nav on auth pages
    if (pathname === "/auth/signin" || pathname === "/auth/signup" || pathname === "/auth/forgot-password" || pathname === "/auth/reset-password") {
        return null
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <div className="flex h-16 items-center">
                <div className="flex items-center">
                    <Link href="/" className="flex items-center">
                        <Image src={logo} alt="Go Viral Logo" width={80} height={80} />
                    </Link>
                </div>

                {/* Center navigation - positioned absolutely for true centering */}
                <div className="absolute left-1/2 -translate-x-1/2">
                    <nav className="hidden md:flex gap-6">
                        <Link
                            href="/creators"
                            className="text-sm font-medium transition-colors hover:text-primary"
                        >
                            Creators
                        </Link>
                        <Link
                            href="/brands"
                            className="text-sm font-medium transition-colors hover:text-primary"
                        >
                            Brands
                        </Link>
                    </nav>
                </div>

                <div className="ml-auto flex items-center">
                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={user.avatar_url || `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(user.email || 'default')}`} alt={user.full_name || "User"} />
                                        <AvatarFallback>{user.full_name?.[0] || user.email?.[0] || "U"}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <div className="flex items-center justify-start gap-2 p-2">
                                    <div className="flex flex-col space-y-1 leading-none">
                                        {user.full_name && <p className="font-medium">{user.full_name}</p>}
                                        {user.email && (
                                            <p className="w-[200px] truncate text-sm text-muted-foreground">
                                                {user.email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard">Dashboard</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/contests">My Contests</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/profile">Profile</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/settings">Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {
                                        signOut();
                                    }}
                                >
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button variant="outline" asChild>
                            <Link href="/auth/signin">Log in</Link>
                        </Button>
                    )}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="ml-2 md:hidden">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle Menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                            <Link href="/" className="flex items-center gap-2">
                                <Logo />
                            </Link>
                            <nav className="mt-8 flex flex-col gap-4">
                                <Link
                                    href="/creators"
                                    className="text-sm font-medium transition-colors hover:text-primary"
                                >
                                    Creators
                                </Link>
                                <Link
                                    href="/brands"
                                    className="text-sm font-medium transition-colors hover:text-primary"
                                >
                                    Brands
                                </Link>
                                {!user && (
                                    <Link
                                        href="/auth/signin"
                                        className="text-sm font-medium transition-colors hover:text-primary"
                                    >
                                        Log in
                                    </Link>
                                )}
                                {user && (
                                    <>
                                        <Link
                                            href="/dashboard"
                                            className="text-sm font-medium transition-colors hover:text-primary"
                                        >
                                            Dashboard
                                        </Link>
                                        <Link
                                            href="/dashboard/profile"
                                            className="text-sm font-medium transition-colors hover:text-primary"
                                        >
                                            Profile
                                        </Link>
                                        <Link
                                            href="/dashboard/settings"
                                            className="text-sm font-medium transition-colors hover:text-primary"
                                        >
                                            Settings
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            className="justify-start px-0 text-sm font-medium"
                                            onClick={() => signOut()}
                                        >
                                            Log out
                                        </Button>
                                    </>
                                )}
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
} 