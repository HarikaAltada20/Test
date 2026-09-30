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
  "group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 pr-10 shadow-xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-top-full",
  {
    variants: {
      variant: {
        default:
          "border-gray-200 bg-white/95 text-gray-950 shadow-2xl backdrop-blur-md border-l-[4px] border-l-[#7F39EC]",
        destructive:
          "destructive group border-red-200 bg-red-50 text-red-950 border-l-[4px] border-l-red-600 shadow-2xl backdrop-blur-md",
        success:
          "success group border-emerald-200 bg-emerald-50 text-emerald-950 border-l-[4px] border-l-emerald-600 shadow-2xl backdrop-blur-md",
        pending:
          "pending group border-amber-200 bg-amber-50 text-amber-950 border-l-[4px] border-l-amber-500 shadow-2xl backdrop-blur-md",
        payment:
          "payment group border-blue-200 bg-blue-50 text-blue-950 border-l-[4px] border-l-blue-600 shadow-2xl backdrop-blur-md",
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
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-900 ring-offset-background transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-red-300 group-[.destructive]:bg-red-100 group-[.destructive]:text-red-950 group-[.success]:border-emerald-300 group-[.success]:bg-emerald-100 group-[.success]:text-emerald-950 group-[.pending]:border-amber-300 group-[.pending]:bg-amber-100 group-[.pending]:text-amber-950 group-[.payment]:border-blue-300 group-[.payment]:bg-blue-100 group-[.payment]:text-blue-950",
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
      "absolute right-2.5 top-2.5 rounded-lg p-1 text-gray-600 opacity-70 transition-all hover:bg-gray-200/80 hover:text-gray-950 hover:opacity-100 focus:opacity-100 focus:outline-none group-[.destructive]:text-red-700 group-[.destructive]:hover:bg-red-100 group-[.success]:text-emerald-700 group-[.success]:hover:bg-emerald-100 group-[.pending]:text-amber-700 group-[.pending]:hover:bg-amber-100 group-[.payment]:text-blue-700 group-[.payment]:hover:bg-blue-100",
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
      "text-[0.9375rem] font-bold leading-snug tracking-tight text-gray-950 dark:text-gray-950 group-[.destructive]:text-red-950 group-[.success]:text-emerald-950 group-[.pending]:text-amber-950 group-[.payment]:text-blue-950",
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
      "whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-700 [&_strong]:font-semibold [&_strong]:text-gray-950 group-[.destructive]:text-red-900 group-[.success]:text-emerald-900 group-[.pending]:text-amber-900 group-[.payment]:text-blue-900",
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
