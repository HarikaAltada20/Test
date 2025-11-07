import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#4A00BE] text-white shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm",
        outline:
          "border border-input bg-background ",
        secondary:
          "bg-secondary text-secondary-foreground",
        ghost: "hover:text-accent-foreground",
        link: "text-primary underline-offset-4",
        selected: "bg-primary text-primary-foreground font-semibold shadow-md border border-primary/20",
        "selected-secondary": "bg-secondary text-secondary-foreground font-semibold shadow-md border border-secondary/20",
        "selected-outline": "bg-primary/10 text-primary font-semibold border-2 border-primary shadow-md",
        white: "bg-white text-gray-900 font-bold border-2 border-gray-300 transition-all duration-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        md:"h-11 rounded-full px-4",
        lg: "h-12 rounded-lg px-8 ",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading

    const content = (
      <>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading && loadingText ? loadingText : children}
      </>
    )

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {asChild ? (
          <span className="inline-flex items-center">
            {content}
          </span>
        ) : (
          content
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
