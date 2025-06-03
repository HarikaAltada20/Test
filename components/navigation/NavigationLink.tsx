"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner"

interface NavigationLinkProps {
    href: string
    children: React.ReactNode
    className?: string
    activeClassName?: string
    onClick?: () => void
    prefetch?: boolean
}

export function NavigationLink({
    href,
    children,
    className,
    activeClassName,
    onClick,
    prefetch = true
}: NavigationLinkProps) {
    const [isNavigating, setIsNavigating] = useState(false)
    const router = useRouter()
    const pathname = usePathname()

    const isActive = pathname === href || pathname.startsWith(href + '/')

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Don't prevent default for same page
        if (pathname === href) return

        // Call external onClick if provided
        onClick?.()

        // Show loading state immediately
        setIsNavigating(true)

        // Reset loading state after a delay
        const resetTimer = setTimeout(() => {
            setIsNavigating(false)
        }, 1500)

        // Cleanup timer on unmount
        return () => clearTimeout(resetTimer)
    }, [pathname, href, onClick])

    return (
        <Link
            href={href}
            onClick={handleClick}
            prefetch={prefetch}
            className={cn(
                "relative flex items-center gap-3 transition-colors",
                isActive && activeClassName,
                className
            )}
        >
            <span className={cn(
                "flex items-center gap-3 w-full",
                isNavigating && "opacity-60"
            )}>
                {children}
            </span>

            {isNavigating && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <ButtonLoadingSpinner />
                </div>
            )}
        </Link>
    )
}

// Specialized version for sidebar navigation
export function SidebarNavigationLink({
    href,
    children,
    icon: Icon,
    ...props
}: NavigationLinkProps & { icon?: React.ComponentType<any> }) {
    return (
        <NavigationLink
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            activeClassName="bg-muted text-primary"
            {...props}
        >
            {Icon && <Icon className="h-4 w-4" />}
            {children}
        </NavigationLink>
    )
} 