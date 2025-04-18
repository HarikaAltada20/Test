"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { BrandLogo } from "@/components/brand-logo"
import { createSupabaseClient } from "@/lib/supabase/client"

export default function VerifyOTPPage() {
    const [otp, setOtp] = useState("")
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const cooldownInterval = useRef<NodeJS.Timeout | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const supabase = createSupabaseClient()

    useEffect(() => {
        // Get email from URL params
        const emailParam = searchParams.get("email")
        if (!emailParam) {
            router.push("/auth/signup")
            toast({
                variant: "destructive",
                title: "Missing Email",
                description: "No email address was provided. Please sign up again.",
                duration: 5000,
            })
            return
        }
        setEmail(emailParam)

        // Set up an initial 30-second window where resend is disabled
        setResendCooldown(30)
        startCooldownTimer()

        return () => {
            // Clean up interval when component unmounts
            if (cooldownInterval.current) {
                clearInterval(cooldownInterval.current)
            }
        }
    }, [searchParams, router, toast])

    const startCooldownTimer = () => {
        // Clear any existing interval
        if (cooldownInterval.current) {
            clearInterval(cooldownInterval.current)
        }

        // Set up a new interval
        cooldownInterval.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    if (cooldownInterval.current) {
                        clearInterval(cooldownInterval.current)
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const handleResendCode = async () => {
        if (resendCooldown > 0) return

        setIsResending(true)
        setError(null)

        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
            })

            if (error) throw error

            toast({
                title: "Code Resent",
                description: "A new verification code has been sent to your email.",
                duration: 5000,
            })

            // Reset cooldown
            setResendCooldown(60)
            startCooldownTimer()
        } catch (err: any) {
            setError(`Failed to resend code: ${err.message}`)
            toast({
                variant: "destructive",
                title: "Failed to Resend",
                description: err.message || "Could not send a new code. Please try again.",
                duration: 5000,
            })
        } finally {
            setIsResending(false)
        }
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        if (otp.length !== 6) {
            setError("Please enter a valid 6-digit OTP code")
            setIsLoading(false)
            return
        }

        try {
            // Store verification attempt in localStorage
            localStorage.setItem('verificationAttempt', JSON.stringify({
                email,
                timestamp: new Date().toISOString()
            }))

            // Verify the OTP with Supabase
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'signup'
            })

            if (error) throw error

            if (!data.session || !data.user) {
                throw new Error("Verification successful, but no session was created. Please try signing in.")
            }

            // Store verification success
            localStorage.setItem('verificationSuccess', 'true')

            // If successful, redirect to username setup
            toast({
                title: "Email verified!",
                description: "Your email has been verified successfully.",
                duration: 3000,
            })

            // Get user data from session
            const userData = data.session.user.user_metadata

            // Store user data in sessionStorage for the next step
            sessionStorage.setItem('signupUserData', JSON.stringify({
                id: data.user.id,
                email: data.user.email,
                fullName: userData.full_name || '',
                userType: userData.user_type || 'creator',
                referralCode: sessionStorage.getItem('referralCode') || null
            }))

            // Redirect to choose username page
            router.push("/choose-username")
        } catch (err: any) {
            setError(err.message || "Failed to verify OTP")
            toast({
                variant: "destructive",
                title: "Verification Failed",
                description: err.message || "Failed to verify your OTP code. Please try again.",
                duration: 5000,
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Check if there was a previous verification attempt that might have succeeded
    useEffect(() => {
        const checkPreviousVerification = async () => {
            const verificationSuccess = localStorage.getItem('verificationSuccess')
            const verificationAttempt = localStorage.getItem('verificationAttempt')

            if (verificationSuccess === 'true' && verificationAttempt) {
                try {
                    const attempt = JSON.parse(verificationAttempt)
                    if (attempt.email === email) {
                        // There was a successful verification for this email
                        const { data } = await supabase.auth.getUser()

                        if (data.user) {
                            // User is authenticated, redirect to setup
                            toast({
                                title: "Already Verified",
                                description: "Your email has already been verified. Continuing setup.",
                                duration: 3000,
                            })

                            // Store user data in sessionStorage
                            sessionStorage.setItem('signupUserData', JSON.stringify({
                                id: data.user.id,
                                email: data.user.email,
                                fullName: data.user.user_metadata.full_name || '',
                                userType: data.user.user_metadata.user_type || 'creator',
                                referralCode: sessionStorage.getItem('referralCode') || null
                            }))

                            router.push("/choose-username")
                        }
                    }
                } catch (err) {
                    // Ignore parsing errors
                    console.error("Error checking previous verification:", err)
                }
            }
        }

        if (email) {
            checkPreviousVerification()
        }
    }, [email, router, toast, supabase.auth])

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md">
                <div className="mb-6">
                    <BrandLogo centered showText={false} size="lg" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Enter the 6-digit code sent to <span className="font-medium">{email}</span>
                        </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-5">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="otp">Verification code</Label>
                            <Input
                                id="otp"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="Enter 6-digit code"
                                value={otp}
                                onChange={(e) => {
                                    // Only allow numbers
                                    const value = e.target.value.replace(/[^0-9]/g, '')
                                    setOtp(value)
                                }}
                                required
                                className="h-11 text-center text-lg tracking-widest"
                            />
                        </div>

                        <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                "Verify Email"
                            )}
                        </Button>

                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resendCooldown > 0 || isResending}
                                className="inline-flex items-center text-sm font-medium text-rose-600 hover:text-rose-700 disabled:text-gray-400"
                            >
                                {isResending ? (
                                    <>
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        Sending...
                                    </>
                                ) : resendCooldown > 0 ? (
                                    <>
                                        Resend code in {resendCooldown}s
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-1 h-3 w-3" />
                                        Resend verification code
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
} 