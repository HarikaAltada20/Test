"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

function sanitizeCode(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export default function ReferralCapture() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const code =
            searchParams.get("ref") ||
            searchParams.get("referral") ||
            searchParams.get("code") ||
            searchParams.get("r");

        if (code) {
            try {
                const sanitized = sanitizeCode(code);
                if (sanitized) {
                    localStorage.setItem("referralCode", sanitized);
                }
            } catch (_) {
                // no-op for SSR/unsupported environments
            }
        }
    }, [searchParams]);

    return null;
}


