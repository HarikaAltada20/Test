"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { BrandLogo } from "@/components/brand-logo"
import { createClient } from "@/utils/supabase/client"

// Define a type for the user data we expect to fetch and use
interface UserProfileData {
    id: string;
    email: string | undefined;
    fullName: string;
    userType: 'creator' | 'advertiser';
    referred_by_code: string | null; // The code this user was referred BY during signup
    // Add other fields from public.users if needed by this page
}

export default function ChooseUsernamePage() {
    const [username, setUsername] = useState("")
    const [userData, setUserData] = useState<UserProfileData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingProfile, setIsLoadingProfile] = useState(true)
    const [isCheckingUsername, setIsCheckingUsername] = useState(false)
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
    const router = useRouter()
    const { toast } = useToast()
    const supabase = createClient()

    useEffect(() => {
        const fetchProfileAndRedirect = async () => {
            setIsLoadingProfile(true)
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

            if (authError || !authUser) {
                console.error("ChooseUsernamePage: Not authenticated or error fetching auth user", authError)
                toast({ variant: "destructive", title: "Not Authenticated", description: "Please sign in to continue.", duration: 5000 })
                router.push("/auth/signin")

                return
            }

            // Fetch user details from public.users table
            // Assuming 'referred_by_code' is the column storing the referral code they used at signup
            const { data: profileData, error: profileFetchError } = await supabase
                .from('users')
                .select('id, email, full_name, user_type, username, referred_by')
                .eq('id', authUser.id)
                .single() // User profile MUST exist here as OTP verification should have created it

            if (profileFetchError) {
                console.error("ChooseUsernamePage: Error fetching user profile from DB:", profileFetchError)
                setError("Could not load your profile. Please try refreshing or contact support.")
                toast({ variant: "destructive", title: "Profile Load Failed", description: profileFetchError.message, duration: 5000 })
                setIsLoadingProfile(false)
                return
            }

            if (!profileData) { // Should not happen with .single() unless DB is out of sync with auth.users
                console.error("ChooseUsernamePage: Profile data is null for authenticated user:", authUser.id)
                setError("Your profile data is missing. Please contact support.")
                toast({ variant: "destructive", title: "Profile Missing", description: "Critical error: profile not found.", duration: 5000 })
                router.push("/auth/signin") // Or an error page
                return
            }

            // If username is already set, redirect to dashboard (middleware should also catch this)
            if (profileData.username) {
                toast({ title: "Setup Complete", description: "Your username is already set.", duration: 3000 })
                router.push("/dashboard")
                router.refresh()
                return
            }

            setUserData({
                id: profileData.id,
                email: profileData.email, // Email from public.users
                fullName: profileData.full_name || "",
                userType: profileData.user_type || "creator",
                referred_by_code: profileData.referred_by || null,
            })
            setIsLoadingProfile(false)
        }

        fetchProfileAndRedirect()
    }, [router, supabase, toast])

    // Check username availability with debounce
    useEffect(() => {
        if (!username || username.length < 3) return

        const timer = setTimeout(async () => {
            setIsCheckingUsername(true)
            setUsernameAvailable(null)

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('username')
                    .eq('username', username)
                    .maybeSingle()

                if (error) throw error

                // If no data returned, username is available
                setUsernameAvailable(!data)
            } catch (err) {
                console.error("Error checking username:", err)
                setUsernameAvailable(null)
            } finally {
                setIsCheckingUsername(false)
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [username, supabase])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        if (!userData || !userData.id) {
            toast({ variant: "destructive", title: "Session Error", description: "User data not loaded. Please refresh.", duration: 5000 })
            setIsLoading(false)
            return
        }

        // Basic validation
        if (username.length < 3) {
            setError("Username must be at least 3 characters")
            setIsLoading(false)
            return
        }

        if (!usernameAvailable) {
            setError("This username is already taken")
            setIsLoading(false)
            return
        }

        try {
            // Step 1: Update the existing user in public.users table
            const { error: updateUserError } = await supabase
                .from('users')
                .update({
                    username: username,
                    referral_code: username, // User's own referral code is their username
                })
                .eq('id', userData.id)

            if (updateUserError) {
                console.error("Error updating user with username:", updateUserError)
                throw new Error(updateUserError.message || "Failed to set your username. Please try again.")
            }

            // Step 2: If a referral code was used during signup (now userData.referred_by_code),
            // process it to give bonus to the REFERRER.
            if (userData.referred_by_code) {
                const { data: referrer, error: referrerError } = await supabase
                    .from('users')
                    .select('id, coins, user_type, creators_referred, advertisers_referred')
                    .eq('referral_code', userData.referred_by_code) // Find referrer by their referral_code
                    .single()

                if (referrerError) {
                    console.error("Error finding referrer by code:", userData.referred_by_code, referrerError)
                    toast({ variant: "default", title: "Referral Note", description: "Could not process the original sign-up referral bonus for the referrer.", duration: 7000 })
                } else if (referrer) {
                    try {
                        // Parameters for your handle_referral RPC
                        const { error: rpcError } = await supabase.rpc('handle_referral', {
                            referrer_id: referrer.id,       // Assuming this is the name in your RPC
                            referred_id: userData.id,       // Assuming this is the name in your RPC
                            ref_code: userData.referred_by_code, // The code used
                            referred_type: userData.userType  // Assuming this is the name in your RPC
                        })
                        if (rpcError) {
                            console.error("Error calling handle_referral RPC:", rpcError)
                            toast({ variant: "destructive", title: "Referral Issue", description: "Could not automatically process bonus for the referrer.", duration: 7000 })
                        } else {
                            console.log("Successfully processed referral for referrer:", referrer.id)
                            toast({ title: "Referral Applied!", description: "Referral bonus processed for the referrer.", duration: 5000 })
                        }
                    } catch (rpcCatchError: any) {
                        console.error("Exception calling handle_referral RPC:", rpcCatchError)
                        toast({ variant: "destructive", title: "Referral Error", description: "Unexpected error processing referral bonus.", duration: 7000 })
                    }
                }
            }

            // Clear sessionStorage (only if you were using it for other things, otherwise not needed)
            // sessionStorage.removeItem('signupUserData') // Not strictly needed anymore for this page's core data
            // sessionStorage.removeItem('referralCode') // This was for the code the current user INPUTTED.

            toast({
                title: "Account setup complete!",
                description: "Welcome aboard!",
                duration: 4000,
            })

            // Redirect to dashboard
            router.push("/dashboard")
            router.refresh()
        } catch (err: any) {
            setError(err.message || "Failed to set up your account")
            toast({
                variant: "destructive",
                title: "Setup Failed",
                description: err.message || "Failed to set up your account. Please try again.",
                duration: 5000,
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Username validation
    const isValidUsername = (value: string) => {
        // Allow only alphanumeric characters and underscores
        return /^[a-zA-Z0-9_]+$/.test(value)
    }

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        // Only update if the username is valid or empty
        if (value === '' || isValidUsername(value)) {
            setUsername(value)
        }
    }

    if (isLoadingProfile) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="w-full max-w-md text-center">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Loading your profile...</p>
                </div>
            </div>
        )
    }

    // If userData is still null after loading (e.g., error during fetch), show error or redirect
    // This specific check might be redundant if fetchProfileAndRedirect handles all error cases with redirects/setErrors.
    if (!userData && !isLoadingProfile) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="w-full max-w-md text-center">
                    <h1 className="text-xl font-semibold text-destructive">Loading Error</h1>
                    <p className="text-muted-foreground mt-2">Could not load user data. {error || "Please try signing in again."}</p>
                    <Button onClick={() => router.push('/auth/signin')} className="mt-4">Go to Sign In</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md">
                <div className="mb-6">
                    <BrandLogo centered showText={false} size="lg" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a username</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            This will also be your referral code
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <div className="relative">
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="Choose a unique username"
                                    value={username}
                                    onChange={handleUsernameChange}
                                    required
                                    className="h-11 pr-10"
                                />
                                {isCheckingUsername && (
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                    </div>
                                )}
                                {!isCheckingUsername && username.length >= 3 && (
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                        {usernameAvailable === true && (
                                            <span className="text-green-500 text-sm">Available</span>
                                        )}
                                        {usernameAvailable === false && (
                                            <span className="text-red-500 text-sm">Taken</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Username must be at least 3 characters and contain only letters, numbers, and underscores
                            </p>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 bg-rose-600 hover:bg-rose-700"
                            disabled={isLoading || !usernameAvailable || username.length < 3 || isCheckingUsername}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                "Complete Sign Up"
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
} 