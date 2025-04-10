"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { BrandLogo } from "@/components/brand-logo"

export default function SignupPage() {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [role, setRole] = useState<"advertiser" | "creator">("advertiser")
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const { signUp } = useAuth()
    const router = useRouter()
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        // Basic validation
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
            const fullName = `${firstName} ${lastName}`.trim()
            const result = await signUp(email, password, fullName, role)

            if (result.success) {
                if (result.emailConfirmationRequired) {
                    toast({
                        title: "Account created!",
                        description: "A verification email has been sent to your email address. Please verify your email before signing in.",
                        duration: 10000, // 10 seconds so they have time to read it
                    })
                    // Redirect to signin page with a verification message
                    setTimeout(() => {
                        router.push("/auth/signin?verification=pending")
                    }, 2000)
                } else {
                    toast({
                        title: "Account created!",
                        description: "Your account has been created successfully.",
                        duration: 3000,
                    })
                    // Delay navigation to dashboard to ensure toast is visible
                    setTimeout(() => {
                        router.push("/dashboard")
                    }, 500)
                }
            } else {
                const isDuplicateEmailError = result.error &&
                    (result.error.includes("already exists") ||
                        result.error.includes("violates unique constraint"));

                setError(result.error || "Failed to sign up")

                toast({
                    variant: "destructive",
                    title: isDuplicateEmailError ? "Account Already Exists" : "Sign up failed",
                    description: isDuplicateEmailError ?
                        <>
                            {result.error}
                            <div className="mt-2">
                                <Button
                                    variant="outline"
                                    className="bg-white text-black hover:bg-gray-100 border-0 text-xs"
                                    onClick={() => router.push("/auth/signin")}
                                >
                                    Go to Sign in
                                </Button>
                            </div>
                        </> :
                        result.error || "Failed to create your account. Please try again.",
                    duration: 8000,
                })

                setIsLoading(false)
            }
        } catch (err: any) {
            setError(err.message || "Failed to sign up")
            toast({
                variant: "destructive",
                title: "Error",
                description: err.message || "Failed to sign up",
                duration: 5000,
            })
            setIsLoading(false)
        }
    }

    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev)
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md">
                <div className="mb-6">
                    <BrandLogo centered showText={false} size="lg" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">The best way to grow your business</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Already have an account?{" "}
                            <Link href="/auth/signin" className="text-primary font-medium hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Tabs defaultValue="advertiser" onValueChange={(value) => setRole(value as "advertiser" | "creator")}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="advertiser">I'm a Brand</TabsTrigger>
                                <TabsTrigger value="creator">I'm a Creator</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First name</Label>
                                <Input
                                    id="firstName"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last name</Label>
                                <Input
                                    id="lastName"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                        </div>

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

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="6+ characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-11 pr-10"
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

                        <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                "Create account"
                            )}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                            By signing up, I agree to the{" "}
                            <Link href="/terms-of-service" className="text-primary hover:underline">
                                Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link href="/privacy-policy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    )
} 