import { Suspense } from 'react'
import { VerifyOtpForm } from './verify-otp-form' // Import the new component
import { Loader2 } from 'lucide-react'
import Image from "next/image";
import logo from "@/public/images/gold_logo_vertical.svg";

// This remains a Server Component (no "use client")
export default function VerifyOTPPage() {
    return (
        <>
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-blue-950 dark:bg-gray-900 px-4 pt-4 pb-16">
                <div className="w-full max-w-md">
                    <div className="mb-10 flex flex-col items-center">
                        <Image
                            src={logo}
                            alt="Game Of Creators Logo"
                            priority
                            width={150}
                            height={150}
                        />
                    </div>
                    <div className="p-[2.5px] rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 animate-border-flow shadow-2xl">
                        <div className="bg-[#0B0F11] dark:bg-gray-800 rounded-lg p-8">
                            {/* Suspense fallback will be styled by VerifyOtpLoading, form content by VerifyOtpForm */}
                            <Suspense fallback={<VerifyOtpLoading />}>
                                <VerifyOtpForm />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

// Loading fallback component
function VerifyOtpLoading() {
    return (
        // This fallback is now within the styled card, so it doesn't need its own full-page background.
        // It will inherit the card's dark background.
        <div className="w-full text-center py-8">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-slate-400 mb-4" />
            <p className="text-slate-300 text-lg">Loading Verification Form...</p>
        </div>
    )
} 