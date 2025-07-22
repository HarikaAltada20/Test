"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle, XCircle, Eye, EyeOff, Trophy, Star, Crown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image";
import logo from "@/public/images/gold_logo_vertical.svg";
import { createClient } from "@/utils/supabase/client"
import { validatePassword, getPasswordErrorMessage } from "@/lib/password-utils"
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter"

interface UserProfileData {
    id: string;
    email: string | undefined;
    userType: 'creator' | 'advertiser';
    referred_by_code: string | null;
    needsUserTypeSelection: boolean;
    needsReferralCodeInput: boolean;
    needsFullName: boolean;
    needsPassword: boolean;
    isGoogleUser: boolean;
}

// Helper to get initial userType from localStorage
function getInitialUserType() {
    if (typeof window !== 'undefined') {
        const storedRole = localStorage.getItem('signupRole');
        if (storedRole === 'brand') {
            return 'advertiser';
        }
    }
    return 'creator';
}

export default function ChooseUsernamePage() {
    const [username, setUsername] = useState("")
    const [userType, setUserType] = useState<'creator' | 'advertiser'>(getInitialUserType);
    const [referralCode, setReferralCode] = useState("")
    const [userData, setUserData] = useState<UserProfileData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingProfile, setIsLoadingProfile] = useState(true)
    const [isCheckingUsername, setIsCheckingUsername] = useState(false)
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)

    // Additional fields for email users
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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

            let { data: profileData, error: profileFetchError } = await supabase
                .from('users')
                .select('id, email, full_name, user_type, username, referred_by')
                .eq('id', authUser.id)
                .maybeSingle()

            // If profile doesn't exist, we'll create it after form completion
            if (profileFetchError && profileFetchError.code !== 'PGRST116') {
                console.error("ChooseUsernamePage: Error fetching user profile from DB:", profileFetchError)
                setError("Could not load your profile. Please try again or contact support.")
                toast({ variant: "destructive", title: "Profile Load Failed", description: profileFetchError.message, duration: 6000 })
                setIsLoadingProfile(false)
                return;
            }

            if (!profileData) {
                console.log("ChooseUsernamePage: No profile found for new user, will create after form completion:", authUser.id)

                // Check if this is a Google user or email user
                const providers = authUser.app_metadata?.providers || [];
                const isAuthGoogleUser = providers.includes('google') && !providers.includes('email');

                // Create temporary profile data for the form without saving to database
                profileData = {
                    id: authUser.id,
                    email: authUser.email!,
                    full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
                    user_type: null, // Will be set by user
                    username: null, // Will be set by user
                    referred_by: null, // Will be set by user
                };

                // All fields need to be completed for new users
                const needsUserTypeSelection = true;
                const needsReferralCodeInput = true;
                const needsFullName = !isAuthGoogleUser; // Email users need first/last name
                const needsPassword = !isAuthGoogleUser; // Email users need password, Google users can optionally add

                setUserData({
                    id: profileData.id,
                    email: profileData.email,
                    userType: userType,
                    referred_by_code: null,
                    needsUserTypeSelection,
                    needsReferralCodeInput,
                    needsFullName,
                    needsPassword,
                    isGoogleUser: isAuthGoogleUser,
                });

                // Set initial form values for names (from Google if available)
                const fullNameParts = (profileData.full_name || "").split(" ");
                setFirstName(fullNameParts[0] || "");
                setLastName(fullNameParts.slice(1).join(" ") || "");

                // Set other initial form values
                setUserType(userType);
                setReferralCode("");

                setIsLoadingProfile(false)
                return;
            }

            if (profileData.username) {
                toast({ title: "Setup Complete!", description: "Your username is already set. Redirecting...", duration: 3000 })
                router.push("/dashboard")
                router.refresh()
                return
            }

            // Check what profile information is missing or needs to be confirmed
            const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
            const authProviders = currentAuthUser?.app_metadata?.providers || [];
            const isAuthGoogleUser = authProviders.includes('google') && !authProviders.includes('email');

            // Determine what information needs to be collected
            const needsUserTypeSelection = !profileData.user_type || isAuthGoogleUser;
            const needsReferralCodeInput = !profileData.referred_by;
            const needsFullName = !profileData.full_name && !isAuthGoogleUser; // Email users need first/last name
            const needsPassword = !isAuthGoogleUser; // Email users need password, Google users can optionally add

            const finalUserType = profileData.user_type || userType;

            setUserData({
                id: profileData.id,
                email: profileData.email,
                userType: finalUserType,
                referred_by_code: profileData.referred_by || null,
                needsUserTypeSelection,
                needsReferralCodeInput,
                needsFullName,
                needsPassword,
                isGoogleUser: isAuthGoogleUser,
            });

            // Set initial form values for names
            const fullNameParts = (profileData.full_name || "").split(" ");
            setFirstName(fullNameParts[0] || "");
            setLastName(fullNameParts.slice(1).join(" ") || "");

            // Set other initial form values
            setUserType(finalUserType);
            setReferralCode(profileData.referred_by || "");

            setIsLoadingProfile(false)
        }

        fetchProfileAndRedirect()
    }, [router, supabase, toast])

    useEffect(() => {
        // Only clear signupRole from localStorage (no need to set userType here)
        if (typeof window !== 'undefined') {
            const storedRole = localStorage.getItem('signupRole');
            if (storedRole === 'brand') {
                localStorage.removeItem('signupRole');
            }
        }
    }, []);

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

        // Validation for all required fields
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

        // Additional validations for email users
        if (userData?.needsFullName && (!firstName.trim() || !lastName.trim())) {
            setError("First name and last name are required.")
            return
        }
        if (userData?.needsPassword && !password) {
            setError("Password is required.")
            return
        }
        if (userData?.needsPassword && password !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }

        // Validate password using comprehensive validation
        if (userData?.needsPassword && password) {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                setError(getPasswordErrorMessage(passwordValidation));
                return;
            }
        }

        setIsLoading(true)
        if (!userData || !userData.id) {
            toast({ variant: "destructive", title: "Session Error", description: "User data not loaded. Please refresh.", duration: 5000 })
            setIsLoading(false)
            return
        }

        try {
            // Get current auth user
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
            if (authError || !authUser) {
                throw new Error("Authentication error. Please sign in again.");
            }

            // Validate referral code if provided
            if (referralCode.trim() && userData.needsReferralCodeInput) {
                const { data: referrerCheck, error: referrerError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', referralCode.trim())
                    .maybeSingle();

                if (referrerError) {
                    console.error("Error checking referral code:", referrerError);
                    throw new Error("Could not verify referral code. Please try again later.");
                }

                if (!referrerCheck) {
                    throw new Error("Invalid referral code. Please check and try again.");
                }
            }

            // Check if this is a new user profile creation
            const { data: existingProfile } = await supabase
                .from('users')
                .select('id')
                .eq('id', userData.id)
                .maybeSingle();

            const isNewProfile = !existingProfile;

            // Update auth user name for email users
            if (userData.needsFullName && firstName.trim() && lastName.trim()) {
                const fullName = `${firstName.trim()} ${lastName.trim()}`;
                try {
                    const { error: authUpdateError } = await supabase.auth.updateUser({
                        data: { full_name: fullName }
                    });
                    if (authUpdateError) {
                        console.warn("Could not update auth user name:", authUpdateError);
                    }
                } catch (authErr) {
                    console.warn("Exception updating auth user name:", authErr);
                }
            }

            // Prepare complete profile data
            const profileData: any = {
                id: userData.id,
                email: userData.email,
                username: username,
                referral_code: username,
                user_type: userType,
                is_active: true,
                email_confirmed_at: new Date().toISOString(),
            };

            // Add full name if provided
            if (userData.needsFullName && firstName.trim() && lastName.trim()) {
                profileData.full_name = `${firstName.trim()} ${lastName.trim()}`;
            } else if (authUser.user_metadata?.full_name) {
                profileData.full_name = authUser.user_metadata.full_name;
            }

            // Add profile picture from Google if available
            if (authUser.user_metadata?.avatar_url) {
                profileData.profile_picture_url = authUser.user_metadata.avatar_url;
            }

            // Add referral code if provided
            if (referralCode.trim()) {
                profileData.referred_by = referralCode.trim();
            }

            // Handle password for email users or Google users who want to enable it
            if (userData.needsPassword && password) {
                try {
                    const { error: passwordError } = await supabase.auth.updateUser({
                        password: password
                    });

                    if (passwordError) {
                        throw new Error(`Failed to set password: ${passwordError.message}`);
                    }
                } catch (passwordErr: any) {
                    console.error('Password update error:', passwordErr);
                    throw new Error(passwordErr.message || 'Failed to set password');
                }
            }

            // Create or update the user profile
            const { error: profileError } = await supabase
                .from('users')
                .upsert(profileData, { onConflict: 'id' });

            if (profileError) {
                console.error('Profile creation/update error:', profileError);
                throw new Error(profileError.message || "Failed to create your profile.");
            }

            // Create profile table entry based on user type
            const profileTable = userType === 'advertiser' ? 'advertiser_profiles' : 'creator_profiles';
            const profileTableData = userType === 'advertiser'
                ? {
                    id: userData.id,
                    subscription_info: {
                        product_id: 'prod_Sduka9mKXu35Ii', // EXPLORER (free) plan
                        price_id: 'price_1RicueDCKN2LN0QeqyngXhRM', // Free price
                        subscription_id: null,
                        last_synced: new Date().toISOString()
                    }
                }
                : { id: userData.id };

            const { error: specificProfileError } = await supabase
                .from(profileTable)
                .upsert(profileTableData, { onConflict: 'id' });

            if (specificProfileError) {
                console.error('Error creating specific profile table entry:', specificProfileError);
                // Don't throw here - main profile creation succeeded, specific profile is secondary
            }

            // --- NEW BONUS AND REFERRAL LOGIC ---
            try {
                const finalReferralCode = referralCode.trim() || userData.referred_by_code;
                if (finalReferralCode) {
                    console.log("Attempting to process referral for code:", finalReferralCode);
                    // Fetch the referrer user by their referral code (which is their username)
                    const { data: referrerUser, error: fetchReferrerError } = await supabase
                        .from('users')
                        .select('id')
                        .eq('username', finalReferralCode) // Usernames are used as referral codes
                        .neq('id', userData.id) // Prevent self-referral
                        .single();

                    if (fetchReferrerError || !referrerUser) {
                        console.warn("Referrer user not found or error fetching for code:", finalReferralCode, fetchReferrerError);
                        toast({ variant: "default", title: "Referral Code Invalid", description: "The referral code used was not found or invalid. You will still receive a welcome bonus.", duration: 7000 });

                        // Fallback: Grant welcome bonus to the current user
                        const { error: welcomeError } = await supabase.rpc('grant_welcome_bonus', {
                            new_user_id: userData.id,
                            p_user_type: userType, // Use the current form value
                            p_user_name: username // The username just set
                        });
                        if (welcomeError) {
                            console.error("Error granting welcome bonus after invalid referral:", welcomeError);
                            toast({ variant: "destructive", title: "Bonus Issue", description: `Welcome bonus might have failed: ${welcomeError.message}`, duration: 7000 });
                        }

                    } else {
                        // Referrer found, proceed with the new process_referral_signup RPC call
                        console.log(`Referrer ${referrerUser.id} found for code ${finalReferralCode}. Calling process_referral_signup for user ${userData.id}`);
                        const { error: rpcError } = await supabase.rpc('process_referral_signup', {
                            p_referred_id: userData.id,
                            p_ref_code: finalReferralCode,
                            p_referrer_id: referrerUser.id,
                            p_referred_user_type: userType, // Use the current form value
                            p_referred_user_name: username // The username just set
                        });

                        if (rpcError) {
                            console.error("Error calling process_referral_signup RPC. Full error object:", JSON.stringify(rpcError, null, 2));
                            console.error("RPC Error Code:", rpcError.code);
                            console.error("RPC Error Message:", rpcError.message);
                            console.error("RPC Error Details:", rpcError.details);
                            console.error("RPC Error Hint:", rpcError.hint);
                            toast({ variant: "default", title: "Referral Processing Note", description: "Could not fully process referral bonus due to: " + (rpcError.message || "Unknown RPC error") + ". Welcome bonus should be applied.", duration: 7000 });
                            // Note: process_referral_signup internally calls grant_welcome_bonus,
                            // so even if this specific part fails, the welcome bonus might have succeeded.
                            // The idempotency in the SQL functions helps.
                        } else {
                            toast({ title: "Referral Applied!", description: "Referral bonus processed.", duration: 5000 });
                        }
                    }
                } else {
                    // No referral code used, just grant welcome bonus
                    console.log(`No referral code for user ${userData.id}. Granting welcome bonus.`);
                    const { error: rpcError } = await supabase.rpc('grant_welcome_bonus', {
                        new_user_id: userData.id,
                        p_user_type: userType, // Use the current form value
                        p_user_name: username // The username just set
                    });
                    if (rpcError) {
                        console.error("Error calling grant_welcome_bonus RPC:", rpcError);
                        toast({ variant: "destructive", title: "Bonus Issue", description: `Welcome bonus might have failed: ${rpcError.message}`, duration: 7000 });
                    } else {
                        // No specific toast needed here if welcome bonus is silently applied,
                        // or you can add one if desired.
                        console.log("Welcome bonus granted for non-referred user:", userData.id);
                    }
                }
            } catch (bonusProcessingError: any) {
                console.error("Exception during bonus/referral processing:", bonusProcessingError);
                toast({ variant: "destructive", title: "Bonus System Error", description: "Unexpected error processing bonuses: " + bonusProcessingError.message, duration: 7000 });
            }
            // --- END OF NEW BONUS AND REFERRAL LOGIC ---

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
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden relative">
                {/* Enhanced Background Elements - Gamified */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(139,92,246,0.15),transparent)]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.15),transparent)]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(59,130,246,0.1),transparent)]"></div>

                {/* Precision Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

                {/* Floating Gaming Elements */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-10 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg rotate-45 opacity-60 animate-pulse"></div>
                    <div className="absolute top-40 right-20 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full opacity-60 animate-pulse" style={{ animationDelay: '2s' }}></div>
                    <div className="absolute bottom-60 left-20 w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-60 animate-pulse" style={{ animationDelay: '4s' }}></div>
                    <Trophy className="absolute top-32 right-10 h-6 w-6 text-yellow-400/60 animate-bounce" style={{ animationDelay: '1s' }} />
                    <Star className="absolute bottom-40 right-40 h-5 w-5 text-pink-400/60 animate-pulse" style={{ animationDelay: '3s' }} />
                    <CheckCircle className="absolute top-60 left-40 h-7 w-7 text-cyan-400/60 animate-bounce" style={{ animationDelay: '5s' }} />
                </div>

                <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
                    <div className="w-full max-w-lg">
                        {/* Premium Logo */}
                        <div className="text-center mb-8">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="relative bg-gradient-to-br from-slate-800/60 to-slate-700/60 p-4 rounded-2xl border border-violet-400/20 backdrop-blur-md shadow-xl shadow-violet-500/10">
                                    <Image src={logo} alt="Game of Creators" width={200} height={50} className="mx-auto" />
                                </div>
                            </div>
                        </div>

                        {/* Enhanced Gaming Container */}
                        <div className="relative group">
                            {/* Gaming Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>

                            <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-violet-400/30 shadow-2xl shadow-violet-500/20">
                                {/* Gaming Header */}
                                <div className="mb-8 text-center">
                                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-purple-600/20 backdrop-blur-sm border border-violet-400/30 rounded-full px-4 py-2 mb-4 shadow-xl shadow-violet-500/20">
                                        <Crown className="h-4 w-4 text-violet-400" />
                                        <span className="text-xs font-semibold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                                            FINAL STEP
                                        </span>
                                    </div>
                                    <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">
                                        <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                                            Complete
                                        </span>{" "}
                                        <span className="text-white">Your</span>{" "}
                                        <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                                            Profile
                                        </span>
                                    </h1>
                                    <p className="text-slate-300 leading-relaxed">
                                        {userData?.isGoogleUser
                                            ? "🎮 Almost there! Complete your gaming profile to unlock all features."
                                            : userData?.needsUserTypeSelection || userData?.needsReferralCodeInput
                                                ? "🚀 Final setup - choose your identity and claim your unique username."
                                                : "⚡ Claim your unique username and join the Game Of Creators arena."
                                        }
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {/* First Name & Last Name - only for email users */}
                                    {userData?.needsFullName && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
                                                <Input
                                                    id="firstName"
                                                    name="given-name"
                                                    type="text"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                                                    placeholder="First name"
                                                    autoComplete="given-name"
                                                    required={userData?.needsFullName}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
                                                <Input
                                                    id="lastName"
                                                    name="family-name"
                                                    type="text"
                                                    value={lastName}
                                                    onChange={(e) => setLastName(e.target.value)}
                                                    className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                                                    placeholder="Last name"
                                                    autoComplete="family-name"
                                                    required={userData?.needsFullName}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Password Fields - Only for email users */}
                                    {userData?.needsPassword && (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="password" className="text-slate-300">Password</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="password"
                                                        name="new-password"
                                                        type={showPassword ? "text" : "password"}
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500 pr-10"
                                                        placeholder="Enter your password"
                                                        autoComplete="new-password"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                                                    >
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="confirmPassword"
                                                        name="confirm-password"
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500 pr-10"
                                                        placeholder="Confirm your password"
                                                        autoComplete="new-password"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>

                                                {/* Real-time Password Strength Meter */}
                                                <PasswordStrengthMeter
                                                    password={password}
                                                    className="mt-3"
                                                    showRequirements={true}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Username Field */}
                                    <div className="space-y-2">
                                        <Label htmlFor="username" className="text-slate-300">Username</Label>
                                        <div className="relative">
                                            <Input
                                                id="username"
                                                name="username"
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
                                                autoComplete="off"
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

                                    {/* User Type Selection - show if needed */}
                                    {userData?.needsUserTypeSelection && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">I am a</Label>
                                            <Tabs
                                                value={userType}
                                                onValueChange={(value) =>
                                                    setUserType(value as "advertiser" | "creator")
                                                }
                                                className="w-full"
                                            >
                                                <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                                                    <TabsTrigger value="creator" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">Creator</TabsTrigger>
                                                    <TabsTrigger value="advertiser" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">Brand</TabsTrigger>
                                                </TabsList>
                                            </Tabs>
                                            <p className="text-xs text-slate-500">
                                                Choose "Creator" if you create content, "Brand" if you're advertising products/services.
                                            </p>
                                        </div>
                                    )}

                                    {/* Referral Code Input - moved to the end */}
                                    {userData?.needsReferralCodeInput && (
                                        <div className="space-y-2">
                                            <Label htmlFor="referralCode" className="text-slate-300">
                                                Referral Code{" "}
                                                <span className="text-slate-500">(Optional)</span>
                                            </Label>
                                            <Input
                                                id="referralCode"
                                                type="text"
                                                value={referralCode}
                                                onChange={(e) => setReferralCode(e.target.value)}
                                                className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                                                placeholder="Enter referral code"
                                            />
                                            <p className="text-xs text-slate-500">
                                                Have a referral code? Enter it here to earn bonus rewards!
                                            </p>
                                        </div>
                                    )}

                                    {error && (
                                        <Alert variant="destructive" className="mt-4">
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    {/* Gaming CTA Button */}
                                    <Button
                                        type="submit"
                                        className="group relative w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-2xl shadow-violet-500/40 hover:shadow-violet-500/60 transition-all duration-300 hover:scale-105 border border-violet-400/30 overflow-hidden"
                                        disabled={isLoading || isCheckingUsername || usernameAvailable !== true || username.length < 3}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                <span className="relative z-10">Activating Profile...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Crown className="mr-2 h-5 w-5" />
                                                <span className="relative z-10">Enter The Arena</span>
                                                <Trophy className="ml-2 h-5 w-5" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}