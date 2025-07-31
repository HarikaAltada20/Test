"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, CheckCircle, Shield, Crown, Trophy, Star, Sparkles, Key, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import logo from "@/public/images/gold_logo_vertical.svg"
import { createClient } from "@/utils/supabase/client"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const { toast } = useToast()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            const normalizedEmail = email.trim().toLowerCase(); // Normalize email

            // 1. Check if the email exists in your public users table
            const { data: userExists, error: checkError } = await supabase
                .from('users') // Your public users table name
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116: no rows found, not an error for this check
                console.error("Error checking email existence:", checkError);
                setError("Could not verify email. Please try again later.");
                toast({ variant: "destructive", title: "Verification Error", description: "Could not verify your email. Please try again." });
                setIsLoading(false);
                return;
            }

            if (!userExists) {
                setError("No account found with this email address. Please ensure you entered it correctly or register for an account.");
                toast({
                    variant: "destructive",
                    title: "Champion Not Found",
                    description: "No account found with this email address.",
                    duration: 6000,
                });
                setIsLoading(false);
                return;
            }

            // 2. If email exists, proceed to send reset link
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`
            });

            if (resetError) throw resetError;

            setIsSuccess(true)
            toast({
                title: "Reset Link Dispatched! 🚀",
                description: "Check your email for the password reset portal.",
                duration: 5000,
            })
        } catch (err: any) {
            setError(err.message || "Failed to send reset password email")
            toast({
                variant: "destructive",
                title: "Dispatch Failed",
                description: err.message || "Failed to send reset password email",
                duration: 5000,
            })
        } finally {
            setIsLoading(false)
        }
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
                <Key className="absolute bottom-20 right-20 h-6 w-6 text-amber-400/60 animate-pulse" style={{ animationDelay: '2.5s' }} />
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
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600/20 to-orange-600/20 backdrop-blur-sm border border-amber-400/30 rounded-full px-4 py-2 mb-4 shadow-xl shadow-amber-500/20">
                                    <Key className="h-4 w-4 text-amber-400" />
                                    <span className="text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                                        RECOVERY MODE
                                    </span>
                                </div>

                                <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">
                                    <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                                        Recover
                                    </span>{" "}
                                    <span className="text-white">Your</span>{" "}
                                    <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                                        Access
                                    </span>
                                </h1>

                                {!isSuccess && (
                                    <p className="text-slate-300 leading-relaxed">
                                        🔑 Enter your email to receive arena access recovery
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
                                        <h3 className="text-3xl font-bold text-white">Recovery Portal Sent!</h3>
                                        <p className="text-slate-300">
                                            🚀 We've dispatched a recovery link to{" "}
                                            <span className="font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                                                {email}
                                            </span>
                                        </p>
                                    </div>

                                    <Button
                                        className="group relative w-full bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 hover:from-emerald-500 hover:via-cyan-500 hover:to-blue-500 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:scale-105 border border-emerald-400/30 overflow-hidden"
                                        asChild
                                    >
                                        <Link href="/auth/signin">
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                                            <div className="relative z-10 flex items-center justify-center gap-3">
                                                <Shield className="h-5 w-5 flex-shrink-0" />
                                                <span>Return to Arena</span>
                                                <Crown className="h-5 w-5 flex-shrink-0" />
                                            </div>
                                        </Link>
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Email Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-slate-300 font-medium">Email Address</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="Enter your registered email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="pl-10 h-12 bg-slate-900/70 border-slate-600/50 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Error Display */}
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                            <p className="text-red-400 text-sm">{error}</p>
                                        </div>
                                    )}

                                    {/* Gaming Recovery Button */}
                                    <Button
                                        type="submit"
                                        className="group relative w-full bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:via-orange-500 hover:to-red-500 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 transition-all duration-300 hover:scale-105 border border-amber-400/30 overflow-hidden"
                                        disabled={isLoading}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                <span className="relative z-10">Dispatching Recovery...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Key className="mr-2 h-5 w-5" />
                                                <span className="relative z-10">Send Recovery Portal</span>
                                                <Sparkles className="ml-2 h-5 w-5" />
                                            </>
                                        )}
                                    </Button>

                                    {/* Back Link */}
                                    <div className="text-center pt-4">
                                        <Link
                                            href="/auth/signin"
                                            className="inline-flex items-center text-slate-400 hover:text-slate-300 transition-colors font-medium"
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Return to arena entrance
                                        </Link>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 