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
import { createSupabaseClient } from "@/lib/supabase/client"

export default function ChooseUsernamePage() {
    const [username, setUsername] = useState("")
    const [userData, setUserData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isCheckingUsername, setIsCheckingUsername] = useState(false)
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
    const router = useRouter()
    const { toast } = useToast()
    const supabase = createSupabaseClient()

    useEffect(() => {
        // Get user data from sessionStorage
        const storedUserData = sessionStorage.getItem('signupUserData')
        if (!storedUserData) {
            router.push("/auth/signup")
            toast({
                variant: "destructive",
                title: "Session Expired",
                description: "Your signup session has expired. Please sign up again.",
                duration: 5000,
            })
            return
        }

        try {
            const parsedUserData = JSON.parse(storedUserData)
            setUserData(parsedUserData)
        } catch (err) {
            router.push("/auth/signup")
        }
    }, [router, toast])

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
            // Ensure we have userData
            if (!userData) throw new Error("User data not found")

            // Check if user already exists in the users table
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('id', userData.id)
                .maybeSingle()

            if (checkError) {
                console.error("Error checking if user exists:", checkError)
            }

            // Create or update user in custom users table
            if (!existingUser) {
                // User doesn't exist in custom table yet, create them
                const { error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: userData.id,
                        email: userData.email,
                        full_name: userData.fullName,
                        user_type: userData.userType,
                        username: username,
                        referral_code: username,
                        coins: 100, // Give 100 welcome coins to all users
                        advertisers_referred: 0,
                        creators_referred: 0
                    })

                if (insertError) throw insertError

                // Create welcome bonus transaction
                await supabase.from('coin_transactions').insert([{
                    user_id: userData.id,
                    type: 'earned',
                    status: 'success',
                    coins: 100,
                    description: `Welcome bonus for joining Game Of Creators`
                }])
            } else {
                // User exists, update their info
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        username: username,
                        referral_code: username,
                        full_name: userData.fullName,
                        user_type: userData.userType,
                    })
                    .eq('id', userData.id)

                if (updateError) throw updateError
            }

            // Initialize the appropriate profile based on user type
            if (userData.userType === 'creator') {
                const { error: profileError } = await supabase
                    .from('creator_profiles')
                    .insert([{
                        id: userData.id,
                        total_contests_participated: 0,
                        total_contests_won: 0,
                        total_money_won: 0,
                        withdrawable_balance: 0,
                        total_views: 0
                    }])

                if (profileError) throw profileError
            } else if (userData.userType === 'advertiser') {
                const { error: profileError } = await supabase
                    .from('advertiser_profiles')
                    .insert([{
                        id: userData.id,
                        subscription_plan: 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198', // FREE plan ID
                        total_money_spent: 0,
                        total_contests_run: 0,
                        available_deposit_balance: 0,
                        withdrawable_balance: 0
                    }])

                if (profileError) throw profileError
            }

            // If a referral code was provided, process it
            if (userData.referralCode) {
                // Check if referral code exists
                const { data: referrer, error: referrerError } = await supabase
                    .from('users')
                    .select('id, coins, user_type')
                    .eq('referral_code', userData.referralCode)
                    .single()

                if (referrerError) {
                    console.error("Error finding referrer:", referrerError)
                } else if (referrer) {
                    try {
                        // Call the handle_referral function with correct parameter names
                        // Note: parameter is now ref_code instead of referral_code
                        const { error: procError } = await supabase.rpc('handle_referral', {
                            referrer_id: referrer.id,
                            referred_id: userData.id,
                            ref_code: userData.referralCode,  // Changed parameter name
                            referred_type: userData.userType
                        });

                        if (procError) {
                            console.error("Referral function error:", procError);
                            console.warn("Server-side referral processing failed, falling back to client-side processing");

                            // Fallback to client-side processing if the server function fails
                            // Add 100 more coins to the new user for using a referral
                            await supabase.from('users').update({
                                coins: 200, // 100 welcome + 100 referral
                                referred_by: userData.referralCode
                            }).eq('id', userData.id)

                            // Record referral bonus transaction for new user
                            await supabase.from('coin_transactions').insert([{
                                user_id: userData.id,
                                type: 'referral_bonus',
                                status: 'success',
                                coins: 100,
                                description: `Bonus for using referral code ${userData.referralCode}`
                            }])

                            // First update the coin balance for referrer
                            await supabase.from('users').update({
                                coins: referrer.coins + 100
                            }).eq('id', referrer.id)

                            // Then update the appropriate referral count
                            if (userData.userType === 'creator') {
                                const { data: creatorProfile } = await supabase
                                    .from('users')
                                    .select('creators_referred')
                                    .eq('id', referrer.id)
                                    .single();

                                await supabase.from('users').update({
                                    creators_referred: (creatorProfile?.creators_referred || 0) + 1
                                }).eq('id', referrer.id)
                            } else {
                                const { data: advertiserProfile } = await supabase
                                    .from('users')
                                    .select('advertisers_referred')
                                    .eq('id', referrer.id)
                                    .single();

                                await supabase.from('users').update({
                                    advertisers_referred: (advertiserProfile?.advertisers_referred || 0) + 1
                                }).eq('id', referrer.id)
                            }
                        } else {
                            console.log("Successfully processed referral using server function");
                        }
                    } catch (err) {
                        console.error("Error processing referral:", err)
                    }
                }
            }

            // Clear sessionStorage
            sessionStorage.removeItem('signupUserData')

            // Show success message
            toast({
                title: "Account setup complete!",
                description: "Your username and profile have been created successfully.",
                duration: 3000,
            })

            // Redirect to login page
            router.push("/auth/signin?setup=complete")
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