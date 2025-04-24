import { Suspense } from 'react'
import { VerifyOtpForm } from './verify-otp-form' // Import the new component
import { Loader2 } from 'lucide-react'

// This remains a Server Component (no "use client")
export default function VerifyOTPPage() {
    return (
        // Wrap the client component that uses useSearchParams in Suspense
        <Suspense fallback={<VerifyOtpLoading />}>
            <VerifyOtpForm />
        </Suspense>
    )
}

// Loading fallback component
function VerifyOtpLoading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md text-center">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Loading Verification...</p>
            </div>
        </div>
    )
} 