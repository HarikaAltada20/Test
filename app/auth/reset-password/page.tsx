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
import { BrandLogo } from "@/components/brand-logo"
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
        // Check if we have a hash fragment in the URL (from Supabase auth redirect)
        const hash = window.location.hash
        if (!hash) return

        // If we have a hash, we want to handle the user session
        const handlePasswordReset = async () => {
            try {
                // This will pick up the query params from the URL
                const { error } = await supabase.auth.refreshSession()
                if (error) {
                    throw new Error("Invalid or expired reset link. Please try again.")
                }
            } catch (err: any) {
                setError(err.message)
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: err.message || "Invalid or expired reset link. Please try again.",
                    duration: 5000,
                })
            }
        }

        handlePasswordReset()
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
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            setIsSuccess(true)
            toast({
                title: "Password reset successful",
                description: "Your password has been reset successfully.",
                duration: 5000,
            })
        } catch (err: any) {
            setError(err.message || "Failed to reset password")
            toast({
                variant: "destructive",
                title: "Error",
                description: err.message || "Failed to reset password",
                duration: 5000,
            })
            setIsLoading(false)
        }
    }

    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev)
    }

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(prev => !prev)
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md">
                <div className="mb-6">
                    <BrandLogo centered showText={false} size="lg" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset your password</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Enter a new password for your account
                        </p>
                    </div>

                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                            <h3 className="text-lg font-medium">Password reset successful</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                Your password has been reset successfully.
                            </p>
                            <Button className="mt-6 w-full" asChild>
                                <Link href="/auth/signin">Sign in with new password</Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="password">New password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="6+ characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-11 pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                        onClick={togglePasswordVisibility}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm new password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="6+ characters"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="h-11 pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
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

                            <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting password...
                                    </>
                                ) : (
                                    "Reset password"
                                )}
                            </Button>

                            <div className="text-center">
                                <Link
                                    href="/auth/signin"
                                    className="text-sm text-primary hover:underline"
                                >
                                    Return to sign in
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
} 