"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image";
import logo from "@/public/images/gold_logo_vertical.svg";
import { createClient } from "@/utils/supabase/client"

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const supabase = createClient();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const hash = window.location.hash
        if (!hash) {
            // Potentially redirect or show an error if no hash is present, 
            // as this page is typically accessed via a link with a token.
            // For now, we let it proceed, and Supabase will error if the session is invalid.
        }

        const handlePasswordReset = async () => {
            try {
                const { error: refreshError } = await supabase.auth.refreshSession() // Only refresh if hash exists
                if (refreshError && hash) { // Only throw if hash was present, indicating an attempt to use a link
                    throw new Error("Invalid or expired reset link. Please request a new one.")
                }
                // If there's no hash and no error, user might be trying to access directly or session is already fine.
            } catch (err: any) {
                setError(err.message)
                toast({
                    variant: "destructive",
                    title: "Link Error",
                    description: err.message || "Invalid or expired reset link. Please request a new one.",
                    duration: 6000,
                })
            }
        }
        if (hash) { // Only attempt to handle password reset if there's a hash fragment from the URL
            handlePasswordReset()
        }
    }, [supabase, toast]) // Removed router from dependencies as it's not used in this useEffect

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Passwords do not match",
                duration: 5000,
            })
            setIsLoading(false)
            return
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters")
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Password must be at least 6 characters",
                duration: 5000,
            })
            setIsLoading(false)
            return
        }

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password })
            if (updateError) throw updateError
            setIsSuccess(true)
            toast({
                title: "Password Reset Successful!",
                description: "Your password has been updated. You can now sign in.",
                duration: 5000,
            })
            // Optionally redirect to sign-in after a short delay
            setTimeout(() => router.push("/auth/signin"), 3000);

        } catch (err: any) {
            let errorMessage = "Failed to reset password. Please try again.";
            if (err.message.includes("New password should be different from the old password")) {
                errorMessage = "New password must be different from your old password.";
            } else if (err.message.includes("same as the old password")) {
                errorMessage = "New password cannot be the same as your old password.";
            }
            setError(errorMessage)
            toast({
                variant: "destructive",
                title: "Reset Failed",
                description: errorMessage,
                duration: 5000,
            })
        } finally {
            setIsLoading(false) // Ensure loading is stopped only if not successful and redirecting
        }
    }

    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev)
    }

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(prev => !prev)
    }

    return (
        <>
            <style jsx global>{`
                @keyframes border-flow {
                  0% {
                    background-position: 0% 50%;
                  }
                  50% {
                    background-position: 100% 50%;
                  }
                  100% {
                    background-position: 0% 50%;
                  }
                }
                .animate-border-flow {
                  background-image: linear-gradient(to right, #FBBF24, #F59E0B, #D97706, #F59E0B, #FBBF24);
                  background-size: 300% auto;
                  animation: border-flow 5s linear infinite;
                }
            `}</style>
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
                            <div className="mb-6 text-center">
                                <h1 className="text-3xl font-bold text-white dark:text-white">Reset Your Password</h1>
                                {!isSuccess && (
                                    <p className="text-sm text-slate-400 mt-2">
                                        Choose a new strong password for your account.
                                    </p>
                                )}
                            </div>

                            {isSuccess ? (
                                <div className="flex flex-col items-center justify-center py-4 text-center">
                                    <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
                                    <h3 className="text-2xl font-semibold text-white">Password Reset!</h3>
                                    <p className="text-slate-300 mt-3 text-base">
                                        Your password has been successfully updated.
                                    </p>
                                    <Button className="mt-8 w-full h-11 bg-rose-600 hover:bg-rose-700 text-white" asChild>
                                        <Link href="/auth/signin">Proceed to Sign In</Link>
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {error && (
                                        <Alert variant="destructive">
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-slate-300">New Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                className="h-11 pr-10 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                                                onClick={togglePasswordVisibility}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500">Must be at least 6 characters.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword" className="text-slate-300">Confirm New Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required
                                                className="h-11 pr-10 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                                                onClick={toggleConfirmPasswordVisibility}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white" disabled={isLoading || isSuccess}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Resetting Password...
                                            </>
                                        ) : (
                                            "Set New Password"
                                        )}
                                    </Button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
} 