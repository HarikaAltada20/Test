"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle, Loader2, Eye, EyeOff, Shield, Crown, Trophy, Star, Sparkles, Key, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import logo from "@/public/images/gold_logo_vertical.svg"
import { createClient } from "@/utils/supabase/client"
import { createAdminClient } from '@/utils/supabase/admin'
import { validatePassword, getPasswordErrorMessage } from "@/lib/password-utils"
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter"

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const supabase = createClient()
    const router = useRouter()
    const { toast } = useToast()

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
                    title: "Portal Link Error",
                    description: err.message || "Invalid or expired reset link. Please request a new one.",
                    duration: 6000,
                })
            }
        }
        if (hash) { // Only attempt to handle password reset if there's a hash fragment from the URL
            handlePasswordReset()
        }
    }, [supabase, toast])

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

        // Validate password using comprehensive validation
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            const errorMessage = getPasswordErrorMessage(passwordValidation);
            setError(errorMessage);
            toast({
                variant: "destructive",
                title: "Password Validation Error",
                description: errorMessage,
                duration: 6000,
            });
            setIsLoading(false);
            return;
        }

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password })
            if (updateError) throw updateError

            // Patch app_metadata.providers to include 'email' if missing
            const { data: user } = await supabase.auth.getUser();
            console.log('Current user providers:', user?.user?.app_metadata?.providers);

            if (user && user.user && user.user.app_metadata && !user.user.app_metadata.providers?.includes('email')) {
                console.log('Attempting to patch providers to include email...');

                // Use Supabase admin client with service role key
                try {
                    const supabaseAdmin = createAdminClient();
                    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                        user.user.id,
                        {
                            app_metadata: {
                                ...user.user.app_metadata,
                                providers: [...(user.user.app_metadata.providers || []), 'email']
                            }
                        }
                    );

                    if (updateError) {
                        console.error('Failed to patch providers with admin client:', updateError);
                    } else {
                        console.log('Successfully patched providers to include email using admin client');
                    }
                } catch (patchError) {
                    console.error('Error patching providers with admin client:', patchError);
                }
            } else {
                console.log('Email provider already exists or user metadata not available');
            }

            setIsSuccess(true)
            toast({
                title: "Access Restored! 🚀",
                description: "Your password has been updated. Welcome back, champion!",
                duration: 5000,
            })
            // Redirect to dashboard after successful password reset
            // Using replace to prevent back navigation and refresh to update auth state
            setTimeout(() => {
                router.replace("/dashboard")
                router.refresh()
            }, 3000)

        } catch (err: any) {
            let errorMessage = "Failed to reset password. Please try again."
            if (err.message.includes("New password should be different from the old password")) {
                errorMessage = "New password must be different from your old password."
            } else if (err.message.includes("same as the old password")) {
                errorMessage = "New password cannot be the same as your old password."
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden relative">
            {/* Enhanced Background Elements - Gamified */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(139,92,246,0.15),transparent)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.15),transparent)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(59,130,246,0.1),transparent)]"></div>

            {/* Precision Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

            {/* Floating Gaming Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-20 left-10 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg rotate-45 opacity-60 animate-pulse"></div>
                <div className="absolute top-40 right-20 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full opacity-60 animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute bottom-60 left-20 w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-60 animate-pulse" style={{ animationDelay: '4s' }}></div>
                <Trophy className="absolute top-32 right-10 h-6 w-6 text-yellow-400/60 animate-bounce" style={{ animationDelay: '1s' }} />
                <Star className="absolute bottom-40 right-40 h-5 w-5 text-pink-400/60 animate-pulse" style={{ animationDelay: '3s' }} />
                <Shield className="absolute top-60 left-40 h-7 w-7 text-cyan-400/60 animate-bounce" style={{ animationDelay: '5s' }} />
                <Lock className="absolute bottom-20 right-20 h-6 w-6 text-violet-400/60 animate-pulse" style={{ animationDelay: '2.5s' }} />
            </div>

            <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-lg">
                    {/* Premium Logo */}
                    <div className="text-center mb-8">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="relative bg-gradient-to-br from-slate-800/60 to-slate-700/60 p-4 rounded-2xl border border-violet-400/20 backdrop-blur-md shadow-xl shadow-violet-500/10">
                                <Image src={logo} alt="Game of Creators" width={200} height={50} className="mx-auto" />
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Gaming Container */}
                    <div className="relative group">
                        {/* Gaming Glow Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>

                        <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-violet-400/30 shadow-2xl shadow-violet-500/20">
                            {/* Gaming Header */}
                            <div className="mb-8 text-center">
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-purple-600/20 backdrop-blur-sm border border-violet-400/30 rounded-full px-4 py-2 mb-4 shadow-xl shadow-violet-500/20">
                                    <Lock className="h-4 w-4 text-violet-400" />
                                    <span className="text-xs font-semibold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                                        SECURITY RESET
                                    </span>
                                </div>

                                <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">
                                    <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        Forge New
                                    </span>{" "}
                                    <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                                        Password
                                    </span>
                                </h1>

                                {!isSuccess && (
                                    <p className="text-slate-300 leading-relaxed">
                                        🛡️ Create a powerful new password for your account
                                    </p>
                                )}
                            </div>

                            {isSuccess ? (
                                <div className="text-center space-y-6">
                                    {/* Success Icon */}
                                    <div className="relative mx-auto w-24 h-24">
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full blur-xl opacity-60 animate-pulse"></div>
                                        <div className="relative w-full h-full bg-gradient-to-br from-emerald-600 to-cyan-600 rounded-full flex items-center justify-center border border-emerald-400/30 shadow-xl shadow-emerald-500/20">
                                            <CheckCircle className="h-12 w-12 text-white" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-3xl font-bold text-white">Access Restored!</h3>
                                        <p className="text-slate-300">
                                            🚀 Your password has been successfully updated.<br />
                                            Welcome back to the arena, champion!
                                        </p>
                                    </div>

                                    <Button
                                        className="group relative w-full bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 hover:from-emerald-500 hover:via-cyan-500 hover:to-blue-500 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:scale-105 border border-emerald-400/30 overflow-hidden"
                                        onClick={() => {
                                            router.replace("/dashboard")
                                            router.refresh()
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                                        <Shield className="mr-2 h-5 w-5" />
                                        <span className="relative z-10">Enter Dashboard</span>
                                        <Crown className="ml-2 h-5 w-5" />
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Password Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-slate-300 font-medium">New Password</Label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Create your new password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="pl-10 pr-12 h-12 bg-slate-900/70 border-slate-600/50 placeholder:text-slate-500 text-white focus:border-violet-500 focus:ring-violet-500 rounded-xl"
                                                required
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                                                onClick={togglePasswordVisibility}
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-5 w-5" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Real-time Password Strength Meter */}
                                        <PasswordStrengthMeter
                                            password={password}
                                            className="mt-3"
                                            showRequirements={true}
                                        />
                                    </div>

                                    {/* Confirm Password Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword" className="text-slate-300 font-medium">Confirm New Password</Label>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="Confirm your new password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="pl-10 pr-12 h-12 bg-slate-900/70 border-slate-600/50 placeholder:text-slate-500 text-white focus:border-violet-500 focus:ring-violet-500 rounded-xl"
                                                required
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
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

                                    {/* Error Display */}
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                            <p className="text-red-400 text-sm">{error}</p>
                                        </div>
                                    )}

                                    {/* Gaming Reset Button */}
                                    <Button
                                        type="submit"
                                        className="group relative w-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-2xl shadow-violet-500/40 hover:shadow-violet-500/60 transition-all duration-300 hover:scale-105 border border-violet-400/30 overflow-hidden"
                                        disabled={isLoading || isSuccess}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                <span className="relative z-10">Forging New Password...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="mr-2 h-5 w-5" />
                                                <span className="relative z-10">Forge New Password</span>
                                                <Sparkles className="ml-2 h-5 w-5" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 