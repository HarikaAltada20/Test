"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image";
import logo from "@/public/images/gold_logo_vertical.svg";
import { createClient } from "@/utils/supabase/client"

interface UserProfileData {
    id: string;
    email: string | undefined;
    fullName: string;
    userType: 'creator' | 'advertiser';
    referred_by_code: string | null;
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

            const { data: profileData, error: profileFetchError } = await supabase
                .from('users')
                .select('id, email, full_name, user_type, username, referred_by')
                .eq('id', authUser.id)
                .single()

            if (profileFetchError) {
                console.error("ChooseUsernamePage: Error fetching user profile from DB:", profileFetchError)
                setError("Could not load your profile. Please try again or contact support.")
                toast({ variant: "destructive", title: "Profile Load Failed", description: profileFetchError.message, duration: 6000 })
                return;
            }

            if (!profileData) {
                console.error("ChooseUsernamePage: Profile data is null for authenticated user:", authUser.id)
                setError("Your profile data is missing. This is unexpected. Please contact support.")
                toast({ variant: "destructive", title: "Profile Missing", description: "Critical error: profile not found.", duration: 6000 })
                return;
            }

            if (profileData.username) {
                toast({ title: "Setup Complete!", description: "Your username is already set. Redirecting...", duration: 3000 })
                router.push("/dashboard")
                router.refresh()
                return
            }

            setUserData({
                id: profileData.id,
                email: profileData.email,
                fullName: profileData.full_name || "",
                userType: profileData.user_type || "creator",
                referred_by_code: profileData.referred_by || null,
            })
            setIsLoadingProfile(false)
        }

        fetchProfileAndRedirect()
    }, [router, supabase, toast])

    useEffect(() => {
        if (!username || username.length < 3) {
            setUsernameAvailable(null);
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setUsernameAvailable(false);
            setError("Username can only contain letters, numbers, and underscores (_).");
            return;
        } else {
            setError(null);
        }

        const timer = setTimeout(async () => {
            setIsCheckingUsername(true)
            setUsernameAvailable(null)

            try {
                const { data, error: checkUserError } = await supabase
                    .from('users')
                    .select('username')
                    .eq('username', username)
                    .maybeSingle()

                if (checkUserError) throw checkUserError
                setUsernameAvailable(!data)
            } catch (err) {
                console.error("Error checking username:", err)
                setUsernameAvailable(null)
                setError("Could not verify username. Please try again.");
            } finally {
                setIsCheckingUsername(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [username, supabase])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!username || username.length < 3) {
            setError("Username must be at least 3 characters long.")
            return
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError("Username can only contain letters, numbers, and underscores (_).");
            return;
        }
        if (usernameAvailable === false) {
            setError("This username is taken or invalid. Please choose another.")
            return
        }
        if (usernameAvailable === null && !isCheckingUsername) {
            setError("Please wait for username check to complete or try a different username.");
            return;
        }

        setIsLoading(true)
        if (!userData || !userData.id) {
            toast({ variant: "destructive", title: "Session Error", description: "User data not loaded. Please refresh.", duration: 5000 })
            setIsLoading(false)
            return
        }

        try {
            const { error: updateUserError } = await supabase
                .from('users')
                .update({
                    username: username,
                    referral_code: username,
                })
                .eq('id', userData.id)

            if (updateUserError) {
                throw new Error(updateUserError.message || "Failed to set your username.")
            }

            if (userData.referred_by_code) {
                console.log("userData.referred_by_code", userData.referred_by_code)
                try {
                    const { error: rpcError } = await supabase.rpc('handle_referral', {
                        p_referrer_code: userData.referred_by_code,
                        p_referred_user_id: userData.id,
                        p_referred_user_type: userData.userType
                    });
                    if (rpcError) {
                        console.error("Error calling handle_referral RPC:", rpcError)
                        toast({ variant: "default", title: "Referral Note", description: "Could not automatically process bonus for the referrer due to: " + rpcError.message, duration: 7000 })
                    } else {
                        toast({ title: "Referral Applied!", description: "Referral bonus processed for the referrer.", duration: 5000 })
                    }
                } catch (rpcCatchError: any) {
                    console.error("Exception calling handle_referral RPC:", rpcCatchError)
                    toast({ variant: "destructive", title: "Referral Error", description: "Unexpected error processing referral bonus: " + rpcCatchError.message, duration: 7000 })
                }
            }

            toast({
                title: "Username Set Successfully!",
                description: `Welcome, ${username}! Redirecting you to the dashboard...`,
                duration: 4000,
            })

            router.push("/dashboard")
            router.refresh()
        } catch (err: any) {
            setError(err.message || "Failed to set up your account.")
            toast({
                variant: "destructive",
                title: "Setup Failed",
                description: err.message || "An unexpected error occurred. Please try again.",
                duration: 6000,
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase();
        setUsername(value);
    };

    if (isLoadingProfile) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-blue-950 dark:bg-gray-900 px-4 pt-4 pb-16">
                <div className="w-full max-w-md text-center">
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-slate-400 mb-4" />
                    <p className="text-slate-300 text-lg">Loading your profile...</p>
                </div>
            </div>
        );
    }

    if (error && !userData) {
        return (
            <>
                <style jsx global>{`
                    @keyframes border-flow {
                      0% { background-position: 0% 50%; }
                      50% { background-position: 100% 50%; }
                      100% { background-position: 0% 50%; }
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
                            <Image src={logo} alt="Game Of Creators Logo" priority width={150} height={150} />
                        </div>
                        <div className="p-[2.5px] rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 animate-border-flow shadow-2xl">
                            <div className="bg-[#0B0F11] dark:bg-gray-800 rounded-lg p-8 text-center">
                                <h1 className="text-3xl font-bold text-white mb-4">Error Loading Profile</h1>
                                <Alert variant="destructive" className="mb-6">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                                <Button onClick={() => router.push("/auth/signin")} className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white">
                                    Return to Sign In
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
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
                                <h1 className="text-3xl font-bold text-white">Choose Your Username</h1>
                                <p className="text-slate-400 mt-2">
                                    This will be your unique identity on Game Of Creators.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="text-slate-300">Username</Label>
                                    <div className="relative">
                                        <Input
                                            id="username"
                                            type="text"
                                            value={username}
                                            onChange={handleUsernameChange}
                                            placeholder="e.g., pro_gamer_23"
                                            required
                                            minLength={3}
                                            maxLength={20}
                                            className={`h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500 pr-10 ${usernameAvailable === true ? 'border-green-500' : usernameAvailable === false ? 'border-red-500' : 'border-slate-700'}`}
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            {isCheckingUsername && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
                                            {usernameAvailable === true && username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username) && !isCheckingUsername && <CheckCircle className="h-5 w-5 text-green-500" />}
                                            {usernameAvailable === false && username.length >= 3 && !isCheckingUsername && <XCircle className="h-5 w-5 text-red-500" />}
                                        </div>
                                    </div>
                                    <div className="mt-1.5 space-y-1">
                                        <p className="text-xs text-slate-500">
                                            Letters, numbers, and underscores only. 3-20 characters.
                                        </p>
                                        {username.length > 0 && username.length < 3 && (
                                            <p className="text-xs text-red-500">Must be at least 3 characters.</p>
                                        )}
                                        {username.length >= 3 && !/^[a-zA-Z0-9_]+$/.test(username) && (
                                            <p className="text-xs text-red-500">Invalid format: Only letters, numbers, and underscores allowed.</p>
                                        )}
                                        {usernameAvailable === false && username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username) && !isCheckingUsername && (
                                            <p className="text-xs text-red-500">This username is already taken. Please try another.</p>
                                        )}
                                        {usernameAvailable === true && username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username) && !isCheckingUsername && (
                                            <p className="text-xs text-green-500">This username is available!</p>
                                        )}
                                        <ul className="text-xs text-slate-500 list-disc list-inside pl-1 space-y-0.5 mt-1">
                                            <li>This will be your public identity and referral code.</li>
                                            <li>Your username cannot be changed later.</li>
                                        </ul>
                                    </div>
                                </div>

                                {error && (
                                    <Alert variant="destructive" className="mt-4">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white"
                                    disabled={isLoading || isCheckingUsername || usernameAvailable !== true || username.length < 3}
                                >
                                    {isLoading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting Up Account...</>
                                    ) : (
                                        "Complete Account Setup"
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}