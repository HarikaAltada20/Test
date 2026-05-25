"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { sanitizeReferralCodeForUrl } from "@/lib/referral-links";

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
                const sanitized = sanitizeReferralCodeForUrl(code);
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


