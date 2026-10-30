"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 right-4 z-[9999] flex max-h-screen w-full max-w-[min(100vw-1.5rem,22rem)] flex-col-reverse gap-3 sm:top-6 sm:right-6 sm:max-w-[24rem]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-2xl border border-[#ececef] bg-white p-4 pr-10 text-[#171717] shadow-[0_12px_40px_rgba(16,16,20,0.12)] transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-top-full dark:border-white/10 dark:bg-[#161616] dark:text-white",
  {
    variants: {
      variant: {
        default: "border-l-[3px] border-l-[#1a1a1a] dark:border-l-white",
        destructive: "destructive group border-l-[3px] border-l-red-600",
        success: "success group border-l-[3px] border-l-emerald-600",
        pending: "pending group border-l-[3px] border-l-amber-500",
        payment: "payment group border-l-[3px] border-l-[#1a1a1a] dark:border-l-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & {
      position?:
        | "top-right"
        | "top-center"
        | "top-left"
        | "bottom-right"
        | "bottom-center"
        | "bottom-left";
    }
>(({ className, variant, position = "top-right", ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-[#ececef] bg-[#f6f6f7] px-3 text-sm font-medium text-[#1a1a1a] transition-colors hover:bg-[#e6e6e8] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/20 disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2.5 top-2.5 rounded-full p-1 text-[#737373] opacity-80 transition-all hover:bg-[#e6e6e8] hover:text-[#1a1a1a] hover:opacity-100 focus:opacity-100 focus:outline-none dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "text-[0.9375rem] font-semibold leading-snug tracking-tight text-[#171717] dark:text-white",
      className,
    )}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "whitespace-pre-line text-sm leading-relaxed text-[#737373] dark:text-white/65 [&_strong]:font-semibold [&_strong]:text-[#171717] dark:[&_strong]:text-white",
      className,
    )}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

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
};
