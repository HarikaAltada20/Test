"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import { CheckCircle } from "lucide-react"

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const supabase = createClientSupabaseClient()
    const router = useRouter()

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
            }
        }

        handlePasswordReset()
    }, [supabase])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            setIsLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            setIsSuccess(true)
        } catch (err: any) {
            setError(err.message || "Failed to reset password")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center w-full h-full p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
                    <CardDescription className="text-center">Enter your new password</CardDescription>
                </CardHeader>

                {isSuccess ? (
                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                            <h3 className="text-lg font-medium">Password Reset Successful</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                Your password has been reset successfully.
                            </p>
                            <Button className="mt-4" asChild onClick={() => router.push("/login")}>
                                <Link href="/login">Sign In with New Password</Link>
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
                                <Label htmlFor="password">New Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? "Resetting..." : "Reset Password"}
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