"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, CheckCircle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Logo } from "@/components/logo"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const { resetPassword } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            await resetPassword(email)
            setIsSuccess(true)
        } catch (err: any) {
            setError(err.message || "Failed to send reset password email")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <Logo />
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Forgot Password
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                <Card className="w-full">
                    {isSuccess ? (
                        <CardContent className="space-y-4 p-6">
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                                <h3 className="text-lg font-medium">Check your email</h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    We've sent a password reset link to <span className="font-medium">{email}</span>
                                </p>
                                <Button className="mt-4" asChild>
                                    <Link href="/auth/signin">Return to Login</Link>
                                </Button>
                            </div>
                        </CardContent>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <CardContent className="grid gap-4 p-6">
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col px-6 pb-6">
                                <Button
                                    type="submit"
                                    className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Sending..." : "Send Reset Link"}
                                </Button>
                                <p className="mt-4 text-center text-sm text-muted-foreground">
                                    Remember your password?{" "}
                                    <Link
                                        href="/auth/signin"
                                        className="text-primary hover:underline"
                                    >
                                        Sign in
                                    </Link>
                                </p>
                            </CardFooter>
                        </form>
                    )}
                </Card>
            </div>
        </div>
    )
} 