"use client"

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
    size?: "sm" | "md" | "lg"
    className?: string
    text?: string
}

export function LoadingSpinner({
    size = "md",
    className,
    text = "Loading..."
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: "h-4 w-4",
        md: "h-6 w-6",
        lg: "h-8 w-8"
    }

    return (
        <div className={cn("flex items-center justify-center", className)}>
            <div className="flex items-center space-x-2">
                <svg
                    className={cn(
                        "animate-spin text-primary",
                        sizeClasses[size]
                    )}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
                {text && (
                    <span className="text-sm text-muted-foreground animate-pulse">
                        {text}
                    </span>
                )}
            </div>
        </div>
    )
}

// Page-level loading component
export function PageLoadingSpinner({ text = "Loading page..." }) {
    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <LoadingSpinner size="lg" text={text} />
        </div>
    )
}

// Inline loading for buttons
export function ButtonLoadingSpinner() {
    return (
        <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    )
} 