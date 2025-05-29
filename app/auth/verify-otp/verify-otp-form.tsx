"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export function VerifyOtpForm() {
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (!emailParam) {
      router.replace("/auth/signup");
      toast({
        variant: "destructive",
        title: "Missing Email",
        description: "No email address provided. Please try again.",
        duration: 5000,
      });
      return;
    }
    setEmail(emailParam);
    setResendCooldown(30);
    startCooldownTimer();

    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const checkPreviousVerification = async () => {
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
                description: "Continuing your setup...",
                duration: 3000,
              });
              router.replace("/choose-username");
              return;
            }
          }
        } catch (err) {
          console.error("Error checking previous verification:", err);
        }
      }
    };
    checkPreviousVerification();
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

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otp];
      let pastedDigits = 0;
      for (let i = 0; i < otp.length && i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
        pastedDigits++;
      }
      setOtp(newOtp);

      // Focus the next empty input or the last filled one
      const nextFocusIndex = Math.min(pastedDigits, otp.length - 1);
      if (inputRefs.current[nextFocusIndex]) {
        inputRefs.current[nextFocusIndex]?.focus();
      }
      // If pasted data fills all inputs, attempt to submit
      if (pastedData.length >= otp.length) {
        const otpString = newOtp.join("");
        if (otpString.length === otp.length) {
          // Trigger form submission logic directly or set a flag to submit
          // For now, let's log and the user can click verify
          console.log("OTP auto-filled, ready for submission:", otpString);
          // Or, if you want to auto-submit:
          // handleSubmit(new Event('submit') as any);
        }
      }
    }
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
        title: "Verification Code Resent",
        description: "A new code has been sent to your email.",
        duration: 5000,
      });
      setResendCooldown(60);
      startCooldownTimer();
    } catch (err: any) {
      setError(`Failed to resend code: ${err.message}`);
      toast({
        variant: "destructive",
        title: "Resend Failed",
        description: err.message || "Could not send a new code. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter the full 6-digit verification code.");
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
        token: otpString,
        type: "signup",
      });

      if (verifyError) {
        let friendlyMessage = "Invalid or expired verification code. Please try again.";
        if (verifyError.message.includes("already confirmed")) {
          friendlyMessage = "This email address has already been verified.";
          toast({ title: "Already Verified", description: friendlyMessage, duration: 4000 });
          router.push("/auth/signin");
          setIsLoading(false);
          return;
        }
        throw new Error(friendlyMessage);
      }

      if (!data.session || !data.user) {
        throw new Error("Verification successful, but no session created. Please try signing in.");
      }

      localStorage.setItem("verificationSuccess", "true");
      toast({ title: "Email Verified Successfully!", description: "Proceeding to account setup...", duration: 3000 });

      const authUser = data.user;
      const userMetaData = authUser.user_metadata;

      try {
        const { error: upsertUserError } = await supabase
          .from('users')
          .upsert({
            id: authUser.id,
            email: authUser.email,
            full_name: userMetaData?.full_name || "",
            user_type: userMetaData?.user_type || "creator",
            referral_code: null,
            referred_by: userMetaData?.referral_code || null,
            is_active: true,
            email_confirmed_at: authUser.email_confirmed_at || new Date().toISOString(),
          }, { onConflict: 'id' });

        if (upsertUserError) throw new Error(`Failed to save user profile: ${upsertUserError.message}`);

        const profileTable = userMetaData?.user_type === 'advertiser' ? 'advertiser_profiles' : 'creator_profiles';
        const profileData = userMetaData?.user_type === 'advertiser' ?
          { id: authUser.id, subscription_plan: 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198' } :
          { id: authUser.id };
        await supabase.from(profileTable).upsert(profileData, { onConflict: 'id' });

      } catch (profileError: any) {
        console.error("Error during post-verification profile setup:", profileError);
        toast({ variant: "destructive", title: "Setup Incomplete", description: `Your email is verified, but there was an issue setting up your profile. Please contact support. Details: ${profileError.message}`, duration: 8000 });
      }

      router.push("/choose-username");

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during verification.");
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: err.message || "An unexpected error occurred. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white mb-3">Check Your Email</h2>
        <p className="text-slate-400 mb-1">
          We&apos;ve sent a 6-digit verification code to:
        </p>
        <p className="text-amber-400 font-medium mb-6 break-all">
          {email || "your email address"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-3">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-semibold bg-slate-800 border-slate-700 text-white focus:border-amber-500 focus:ring-amber-500"
                disabled={isLoading}
                pattern="[0-9]"
                inputMode="numeric"
              />
            ))}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white text-base"
            disabled={isLoading || isResending}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
            ) : (
              "Verify Email"
            )}
          </Button>
        </form>

        <div className="mt-6 text-sm">
          <p className="text-slate-400">
            Didn&apos;t receive the code?{" "}
            {resendCooldown > 0 ? (
              <span className="text-slate-500">
                Resend available in {resendCooldown}s
              </span>
            ) : (
              <Button
                variant="link"
                onClick={handleResendCode}
                disabled={isResending || isLoading}
                className="p-0 h-auto font-medium text-amber-500 hover:text-amber-400 disabled:text-slate-500 disabled:no-underline"
              >
                {isResending ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Resending...</>
                ) : (
                  "Resend Code"
                )}
              </Button>
            )}
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            Signed up with the wrong email?{" "}
          </p>
          <p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center text-sm font-medium text-amber-500 hover:text-amber-400"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
