"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";

export function ConditionalFooter() {
    const pathname = usePathname();

    // Hide footer on dashboard pages and auth pages
    const shouldHideFooter = pathname.startsWith('/dashboard') ||
        pathname.startsWith('/auth') ||
        pathname === '/choose-username';

    if (shouldHideFooter) {
        return null;
    }

    return <Footer />;
} 