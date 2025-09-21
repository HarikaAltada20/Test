"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const EnhancedTabs = TabsPrimitive.Root

const EnhancedTabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <div className="overflow-x-auto scrollbar-hide">
        <TabsPrimitive.List
            ref={ref}
            className={cn(
                "flex w-full h-auto min-h-[4rem] py-3 gap-2",
                "min-w-max",
                className
            )}
            {...props}
        />
    </div>
))
EnhancedTabsList.displayName = TabsPrimitive.List.displayName

const EnhancedTabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            "flex items-center justify-center gap-2 px-4 py-3 whitespace-nowrap text-sm font-medium transition-all duration-300",
            "flex-1 min-w-fit",
            "text-muted-foreground hover:text-foreground",
            "data-[state=active]:bg-[#7F39EC] data-[state=active]:border-[#7F39EC] data-[state=active]:text-white data-[state=active]:font-bold",
            // "data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-primary",
            // "data-[state=active]:scale-105 data-[state=active]:ring-2 data-[state=active]:ring-primary/30",
            "data-[state=active]:relative data-[state=active]:z-10",
            "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            className
        )}
        {...props}
    />
))
EnhancedTabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const EnhancedTabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
        )}
        {...props}
    />
))
EnhancedTabsContent.displayName = TabsPrimitive.Content.displayName

export { EnhancedTabs, EnhancedTabsList, EnhancedTabsTrigger, EnhancedTabsContent } 