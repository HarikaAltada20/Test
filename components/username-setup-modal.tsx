"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { AlertCircle, Check } from "lucide-react"

export function UsernameSetupModal() {
    const [username, setUsername] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const { updateUsername } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Basic validation
        if (!username.trim()) {
            setError("Username cannot be empty")
            return
        }

        // Username format validation (alphanumeric with underscores)
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError("Username can only contain letters, numbers, and underscores")
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const { success, error } = await updateUsername(username)

            if (error) {
                setError(error)
                return
            }

            if (success) {
                setSuccess(true)
                // Wait 1 second to show success message before refreshing the page
                setTimeout(() => {
                    window.location.reload()
                }, 1000)
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
                <h2 className="text-xl font-bold mb-2">Choose your username</h2>
                <p className="text-gray-600 mb-6">
                    Please set a unique username to continue using your account.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium mb-1">
                                Username
                            </label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter a username"
                                disabled={isSubmitting || success}
                                className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Usernames can contain letters, numbers, and underscores.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md flex items-center">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md flex items-center">
                                <Check className="h-4 w-4 mr-2" />
                                <span className="text-sm">Username set successfully!</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting || success}
                        >
                            {isSubmitting ? "Setting username..." : success ? "Username set!" : "Continue"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
} 