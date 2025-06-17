"use client"

import { Maximize, Minimize } from "lucide-react"
import { useFullscreen } from "@/hooks/use-fullscreen"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

export function FullscreenToggle({ className }: { className?: string }) {
    const { isFullscreen, isSupported, toggleFullscreen, enterFullscreen, exitFullscreen } = useFullscreen()

    if (!isSupported) {
        return null // Don't show the toggle if fullscreen is not supported
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={className}>
                    <Maximize className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all fullscreen:-rotate-90 fullscreen:scale-0" />
                    <Minimize className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all fullscreen:rotate-0 fullscreen:scale-100" />
                    <span className="sr-only">Toggle fullscreen</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={enterFullscreen}>
                    Enter Fullscreen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exitFullscreen}>
                    Exit Fullscreen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleFullscreen}>
                    Toggle Fullscreen
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
} 