"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react"
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
                    title: "Account Not Found",
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
                title: "Reset link sent",
                description: "Check your email for the password reset link.",
                duration: 5000,
            })
        } catch (err: any) {
            setError(err.message || "Failed to send reset password email")
            toast({
                variant: "destructive",
                title: "Error",
                description: err.message || "Failed to send reset password email",
                duration: 5000,
            })
        } finally {
            setIsLoading(false)
        }
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
                                <h1 className="text-3xl font-bold text-white dark:text-white">Forgot your password?</h1>
                                {!isSuccess && (
                                    <p className="text-sm text-slate-400 mt-2">
                                        Enter your email and we&apos;ll send you a link to reset your password.
                                    </p>
                                )}
                            </div>

                            {isSuccess ? (
                                <div className="flex flex-col items-center justify-center py-4 text-center">
                                    <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
                                    <h3 className="text-2xl font-semibold text-white">Check your email</h3>
                                    <p className="text-slate-300 mt-3 text-base">
                                        We&apos;ve sent a password reset link to <span className="font-medium text-amber-400">{email}</span>
                                    </p>
                                    <Button className="mt-8 w-full h-11 bg-rose-600 hover:bg-rose-700 text-white" asChild>
                                        <Link href="/auth/signin">Return to Sign In</Link>
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
                                        <Label htmlFor="email" className="text-slate-300">Email address</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                                        />
                                    </div>

                                    <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sending Link...
                                            </>
                                        ) : (
                                            "Send Reset Link"
                                        )}
                                    </Button>

                                    <div className="text-center pt-2">
                                        <Link
                                            href="/auth/signin"
                                            className="inline-flex items-center text-sm font-medium text-amber-500 hover:text-amber-400"
                                        >
                                            <ArrowLeft className="mr-1 h-4 w-4" />
                                            Back to Sign In
                                        </Link>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
} 