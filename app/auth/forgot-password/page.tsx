"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/components/ui/use-toast"
import { BrandLogo } from "@/components/brand-logo"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const { forgotPassword } = useAuth()
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            await forgotPassword(email)
            setIsSuccess(true)
            toast({
                title: "Reset link sent",
                description: "Check your email for the password reset link."
            })
        } catch (err: any) {
            setError(err.message || "Failed to send reset password email")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md">
                <div className="mb-6">
                    <BrandLogo centered showText={false} size="lg" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot your password?</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Please enter the email address associated with your account and we&apos;ll send you a link to reset your
                            password.
                        </p>
                    </div>

                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                            <h3 className="text-lg font-medium">Check your email</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                We&apos;ve sent a password reset link to <span className="font-medium">{email}</span>
                            </p>
                            <Button className="mt-6 w-full" asChild>
                                <Link href="/auth/signin">Return to sign in</Link>
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
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="example@gmail.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending request...
                                    </>
                                ) : (
                                    "Send reset link"
                                )}
                            </Button>

                            <div className="text-center">
                                <Link
                                    href="/auth/signin"
                                    className="inline-flex items-center text-sm text-primary hover:underline"
                                >
                                    <ArrowLeft className="mr-1 h-4 w-4" />
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