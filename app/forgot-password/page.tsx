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
        <div className="fixed inset-0 flex items-center justify-center w-full h-full p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href="/login">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <CardTitle className="text-2xl">Forgot Password</CardTitle>
                    </div>
                    <CardDescription>
                        Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>

                {isSuccess ? (
                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                            <h3 className="text-lg font-medium">Check your email</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                We've sent a password reset link to <span className="font-medium">{email}</span>
                            </p>
                            <Button className="mt-4" asChild>
                                <Link href="/login">Return to Login</Link>
                            </Button>
                        </div>
                    </CardContent>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
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
                        <CardFooter className="flex flex-col space-y-4">
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? "Sending..." : "Send Reset Link"}
                            </Button>
                            <div className="text-center text-sm">
                                Remember your password?{" "}
                                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                                    Sign in
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    )
} 