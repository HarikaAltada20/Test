"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/utils/supabase/client";

// This component contains the core logic and UI for OTP verification
export function VerifyOtpForm() {
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams(); // This hook is now safely inside a client component
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (!emailParam) {
      // Redirect immediately if no email is found
      router.replace("/auth/signup"); // Use replace to avoid adding to history
      toast({
        variant: "destructive",
        title: "Missing Email",
        description: "No email address was provided. Please sign up again.",
        duration: 5000,
      });
      return;
    }
    setEmail(emailParam);

    setResendCooldown(30);
    startCooldownTimer();

    return () => {
      if (cooldownInterval.current) {
        clearInterval(cooldownInterval.current);
      }
    };
    // Intentionally omitting router and toast from deps as they are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Check previous verification effect (depends on email state)
  useEffect(() => {
    const checkPreviousVerification = async () => {
      // Check only if email state is set
      if (!email) return;

      const verificationSuccess = localStorage.getItem("verificationSuccess");
      const verificationAttempt = localStorage.getItem("verificationAttempt");

      if (verificationSuccess === "true" && verificationAttempt) {
        try {
          const attempt = JSON.parse(verificationAttempt);
          if (attempt.email === email) {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
              toast({
                title: "Already Verified",
                description: "Continuing setup...",
                duration: 3000,
              });
              // Store user data needed for next step
              sessionStorage.setItem(
                "signupUserData",
                JSON.stringify({
                  id: data.user.id,
                  email: data.user.email,
                  fullName: data.user.user_metadata?.full_name || "",
                  userType: data.user.user_metadata?.user_type || "creator",
                  referralCode: sessionStorage.getItem("referralCode") || null,
                })
              );
              router.replace("/choose-username"); // Use replace
            }
          }
        } catch (err) {
          console.error("Error checking previous verification:", err);
        }
      }
    };
    checkPreviousVerification();
    // Intentionally omitting router, toast, supabase.auth from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const startCooldownTimer = () => {
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !email) return;
    setIsResending(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) throw resendError;
      toast({
        title: "Code Resent",
        description: "A new verification code has been sent.",
        duration: 5000,
      });
      setResendCooldown(60);
      startCooldownTimer();
    } catch (err: any) {
      setError(`Resend failed: ${err.message}`);
      toast({
        variant: "destructive",
        title: "Resend Failed",
        description: err.message || "Could not send code.",
        duration: 5000,
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      localStorage.setItem(
        "verificationAttempt",
        JSON.stringify({ email, timestamp: new Date().toISOString() })
      );
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      if (verifyError) throw verifyError;
      if (!data.session || !data.user)
        throw new Error("Verification successful, but no session created.");

      localStorage.setItem("verificationSuccess", "true");
      toast({ title: "Email verified!", duration: 3000 });

      const authUser = data.user;
      const userMetaData = authUser.user_metadata;

      // --- Create user profile and related data ---
      try {
        // Step 1: Upsert user in public.users table
        const { error: upsertUserError } = await supabase
          .from('users')
          .upsert({
            id: authUser.id,
            email: authUser.email,
            full_name: userMetaData?.full_name || "",
            user_type: userMetaData?.user_type || "creator",
            username: null,
            referral_code: null,
            referred_by: userMetaData?.referral_code || null,
            coins: 100,
            advertisers_referred: 0,
            creators_referred: 0,
            is_active: true,
            email_confirmed_at: authUser.email_confirmed_at || new Date().toISOString(),
          }, {
            onConflict: 'id',
          });

        if (upsertUserError) {
          console.error("Error upserting user in public.users:", upsertUserError);
          throw new Error(`Failed to save user profile: ${upsertUserError.message}`);
        }

        // Step 2: Create welcome bonus transaction (only if not already created for this user - simplistic check)
        const { data: existingCoinTx, error: checkTxError } = await supabase
          .from('coin_transactions')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('type', 'bonus')
          .eq('description', 'Welcome bonus for joining Game Of Creators')
          .maybeSingle();

        if (checkTxError) {
          console.error("Error checking existing coin transaction:", checkTxError);
        }

        if (!existingCoinTx) {
          const { error: coinTxError } = await supabase.from('coin_transactions').insert([{
            user_id: authUser.id,
            type: 'bonus',
            status: 'success',
            coins: 100,
            description: `Welcome bonus for joining Game Of Creators`
          }]);
          if (coinTxError) {
            console.error("Error creating welcome bonus transaction (full error object):", JSON.stringify(coinTxError, null, 2));
          }
        }

        // Step 3: Initialize the appropriate profile table (creator_profiles or advertiser_profiles)
        const userType = userMetaData?.user_type || "creator";
        if (userType === 'creator') {
          const { error: creatorProfileError } = await supabase
            .from('creator_profiles')
            .upsert({
              id: authUser.id,
              total_contests_participated: 0,
              total_contests_won: 0,
              total_money_won: 0,
              withdrawable_balance: 0,
              total_views: 0
            }, { onConflict: 'id' });
          if (creatorProfileError) console.error("Error upserting creator profile:", creatorProfileError);
        } else if (userType === 'advertiser') {
          const { error: advertiserProfileError } = await supabase
            .from('advertiser_profiles')
            .upsert({
              id: authUser.id,
              subscription_plan: 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198',
              total_money_spent: 0,
              total_contests_run: 0,
              available_deposit_balance: 0,
              withdrawable_balance: 0
            }, { onConflict: 'id' });
          if (advertiserProfileError) console.error("Error upserting advertiser profile:", advertiserProfileError);
        }

      } catch (profileSetupError: any) {
        console.error("Error during post-verification profile setup:", profileSetupError);
        toast({
          variant: "destructive",
          title: "Profile Setup Failed",
          description: `Your email is verified, but we couldn\'t set up your profile. Please contact support. Error: ${profileSetupError.message}`,
          duration: 10000,
        });
        setIsLoading(false);
        return;
      }
      // --- End of profile setup ---

      router.push("/choose-username");
    } catch (err: any) {
      setError(err.message || "Failed to verify OTP");
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: err.message || "Failed to verify OTP.",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Display loading or message while email is being fetched from params
  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Main UI once email is loaded
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <BrandLogo centered showText={false} size="lg" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Verify your email
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium">{email}</span>
            </p>
          </div>
          <form onSubmit={handleVerify} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="123456"
                required
                className="text-center text-lg tracking-widest"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Verify Email
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              size="sm"
              onClick={handleResendCode}
              disabled={isResending || resendCooldown > 0}
              className="text-sm text-muted-foreground"
            >
              {isResending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Resend code {resendCooldown > 0 ? `(${resendCooldown}s)` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
