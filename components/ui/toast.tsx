"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 right-4 z-[9999] flex max-h-screen w-full max-w-[min(100vw-1.5rem,22rem)] flex-col-reverse gap-3 sm:top-6 sm:right-6 sm:max-w-[24rem]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 pr-10 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-top-full",
  {
    variants: {
      variant: {
        default:
          "border-gray-200/90 bg-white/95 text-gray-900 shadow-[0_10px_40px_-10px_rgba(74,0,190,0.22)] backdrop-blur-md border-l-[3px] border-l-[#4A00BE] dark:border-white/10 dark:border-l-[#7F39EC] dark:bg-[#141018]/98 dark:text-white dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)]",
        destructive:
          "destructive group border-red-200/90 bg-red-50 text-red-950 border-l-[3px] border-l-red-600 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.2)] dark:border-red-950/50 dark:border-l-red-500 dark:bg-[#1c1010] dark:text-red-50 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]",
        success:
          "success group border-emerald-200/90 bg-emerald-50 text-emerald-950 border-l-[3px] border-l-emerald-600 shadow-[0_10px_40px_-10px_rgba(5,150,105,0.22)] backdrop-blur-md dark:border-emerald-950/45 dark:border-l-emerald-500 dark:bg-[#0c1814] dark:text-emerald-50 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]",
        pending:
          "pending group border-amber-200/90 bg-amber-50 text-amber-950 border-l-[3px] border-l-amber-500 shadow-[0_10px_40px_-10px_rgba(217,119,6,0.2)] backdrop-blur-md dark:border-amber-950/40 dark:border-l-amber-400 dark:bg-[#18140c] dark:text-amber-50 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]",
        payment:
          "payment group border-blue-200/90 bg-blue-50 text-blue-950 border-l-[3px] border-l-blue-600 shadow-[0_10px_40px_-10px_rgba(37,99,235,0.2)] backdrop-blur-md dark:border-blue-950/45 dark:border-l-blue-500 dark:bg-[#0c1218] dark:text-blue-50 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    position?: "top-right" | "top-center" | "top-left" | "bottom-right" | "bottom-center" | "bottom-left";
  }
>(({ className, variant, position = "top-right", ...props }, ref) => {
  // Create position-based classes
  const positionClasses = {
    "top-right": "top-0 right-0",
    "top-center": "top-0 left-1/2 transform -translate-x-1/2",
    "top-left": "top-0 left-0",
    "bottom-right": "bottom-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "bottom-center": "bottom-0 left-1/2 transform -translate-x-1/2",
  }

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive group-[.success]:border-emerald-300/60 group-[.success]:text-emerald-900 group-[.success]:hover:bg-emerald-100 group-[.success]:hover:text-emerald-950 dark:group-[.success]:border-emerald-700/50 dark:group-[.success]:text-emerald-100 dark:group-[.success]:hover:bg-emerald-950/60 dark:group-[.success]:hover:text-emerald-50 group-[.pending]:border-amber-300/70 group-[.pending]:text-amber-950 group-[.pending]:hover:bg-amber-100 dark:group-[.pending]:border-amber-600/50 dark:group-[.pending]:text-amber-100 dark:group-[.pending]:hover:bg-amber-950/50 group-[.payment]:border-blue-300/60 group-[.payment]:text-blue-900 group-[.payment]:hover:bg-blue-100 group-[.payment]:hover:text-blue-950 dark:group-[.payment]:border-blue-600/50 dark:group-[.payment]:text-blue-100 dark:group-[.payment]:hover:bg-blue-950/50 dark:group-[.payment]:hover:text-blue-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-lg p-1.5 text-gray-500 opacity-60 transition-all hover:bg-gray-100 hover:text-gray-900 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#4A00BE]/25 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus:ring-purple-500/30 group-[.destructive]:text-red-600/80 group-[.destructive]:hover:bg-red-100 group-[.destructive]:hover:text-red-900 dark:group-[.destructive]:text-red-300 dark:group-[.destructive]:hover:bg-red-950/50 dark:group-[.destructive]:hover:text-red-50 group-[.success]:text-emerald-700/80 group-[.success]:hover:bg-emerald-100 group-[.success]:hover:text-emerald-950 dark:group-[.success]:text-emerald-400/90 dark:group-[.success]:hover:bg-emerald-950/50 dark:group-[.success]:hover:text-emerald-50 dark:group-[.success]:focus:ring-emerald-500/30 group-[.pending]:text-amber-700/85 group-[.pending]:hover:bg-amber-100 group-[.pending]:hover:text-amber-950 dark:group-[.pending]:text-amber-400/90 dark:group-[.pending]:hover:bg-amber-950/50 dark:group-[.pending]:hover:text-amber-50 dark:group-[.pending]:focus:ring-amber-500/35 group-[.payment]:text-blue-700/85 group-[.payment]:hover:bg-blue-100 group-[.payment]:hover:text-blue-950 dark:group-[.payment]:text-blue-400/90 dark:group-[.payment]:hover:bg-blue-950/50 dark:group-[.payment]:hover:text-blue-50 dark:group-[.payment]:focus:ring-blue-500/35",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "text-[0.9375rem] font-semibold leading-snug tracking-tight text-gray-900 dark:text-white group-[.destructive]:text-red-950 dark:group-[.destructive]:text-red-50 group-[.success]:text-emerald-950 dark:group-[.success]:text-emerald-50 group-[.pending]:text-amber-950 dark:group-[.pending]:text-amber-50 group-[.payment]:text-blue-950 dark:group-[.payment]:text-blue-50",
      className
    )}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "text-sm leading-relaxed text-gray-600 dark:text-slate-400 [&_strong]:font-semibold [&_strong]:text-gray-800 dark:[&_strong]:text-slate-200 group-[.destructive]:text-red-900/90 dark:group-[.destructive]:text-red-200/90 group-[.destructive]:[&_strong]:text-red-950 dark:group-[.destructive]:[&_strong]:text-red-100 group-[.success]:text-emerald-900/90 dark:group-[.success]:text-emerald-200/90 group-[.success]:[&_strong]:text-emerald-950 dark:group-[.success]:[&_strong]:text-emerald-100 group-[.pending]:text-amber-900/90 dark:group-[.pending]:text-amber-200/90 group-[.pending]:[&_strong]:text-amber-950 dark:group-[.pending]:[&_strong]:text-amber-100 group-[.payment]:text-blue-900/90 dark:group-[.payment]:text-blue-200/90 group-[.payment]:[&_strong]:text-blue-950 dark:group-[.payment]:[&_strong]:text-blue-100",
      className
    )}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
