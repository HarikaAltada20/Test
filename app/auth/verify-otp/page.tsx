"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Crown,
  Trophy,
  Star,
  Sparkles,
  Shield,
  Zap,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/images/gold_logo_horizontal.svg";

export default function VerifyOTPPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get email from localStorage or redirect back to auth
    const storedEmail = localStorage.getItem("auth-email");
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      router.push("/auth/signin");
    }
  }, [router]);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit code");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (verifyError) {
        throw verifyError;
      }

      if (!data.user) {
        throw new Error("Verification failed - no user data");
      }

      // Clear stored email
      localStorage.removeItem("auth-email");

      toast({
        title: "Access Granted! 🚀",
        description: "Your email has been verified. Welcome to the arena!",
        duration: 3000,
      });

      // Redirect to choose-username for profile completion
      router.push("/choose-username");
      router.refresh();
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err.message || "Invalid verification code");
      toast({
        variant: "destructive",
        title: "Access Denied",
        description:
          err.message || "Invalid verification code. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError(null);
    setIsResending(true);

    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Don't use callback for email OTP - users will manually enter code
          shouldCreateUser: false, // User already exists, just resending
        },
      });

      if (resendError) {
        throw resendError;
      }

      toast({
        title: "Code Dispatched! ⚡",
        description: "A new verification code has been sent to your email.",
        duration: 5000,
      });
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      setError(err.message || "Failed to resend code");
      toast({
        variant: "destructive",
        title: "Dispatch Failed",
        description: err.message || "Failed to resend verification code.",
        duration: 5000,
      });
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          {/* Loader */}
          <div className="p-8 bg-slate-900 rounded-full inline-block">
            <Loader2 className="h-12 w-12 animate-spin text-violet-400" />
          </div>
          {/* Text below loader */}
          <p className="mt-6 text-slate-300 font-medium">
            Initializing verification portal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000825] overflow-hidden relative">
      {/* Floating Gaming Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg rotate-45 opacity-60 animate-pulse"></div>
        <div
          className="absolute top-40 right-20 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full opacity-60 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute bottom-60 left-20 w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-60 animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
        <Trophy
          className="absolute top-32 right-10 h-6 w-6 text-yellow-400/60 animate-bounce"
          style={{ animationDelay: "1s" }}
        />
        <Star
          className="absolute bottom-40 right-40 h-5 w-5 text-pink-400/60 animate-pulse"
          style={{ animationDelay: "3s" }}
        />
        <Shield
          className="absolute top-60 left-40 h-7 w-7 text-cyan-400/60 animate-bounce"
          style={{ animationDelay: "5s" }}
        />
        <CheckCircle
          className="absolute bottom-20 right-20 h-6 w-6 text-emerald-400/60 animate-pulse"
          style={{ animationDelay: "2.5s" }}
        />
      </div>

      <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          {/* Premium Logo */}
          <div className="text-center">
            <div className="relative group">
              <div className="absolute inset-0 transition-opacity duration-500"></div>
              <div className="relative  p-4 ">
                <Image
                  src={logo}
                  alt="Game of Creators"
                  width={200}
                  height={70}
                  className="mx-auto"
                />
              </div>
            </div>
          </div>

          {/* Enhanced Gaming Container */}
          <div className="relative group">
            {/* Gaming Glow Effect */}

            <div className="relative p-8 rounded-2xl">
              {/* Gaming Header */}
              <div className="mb-8 text-center">
                <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">
                  Check Your Email
                </h1>
                <p className="text-slate-300 text-lg leading-relaxed mb-8">
                  Start your creator journey and unlock epic opportunities
                </p>
                <p className="text-slate-300 text-lg leading-relaxed mb-2">
                  We sent a 6-digit verification code to
                </p>
                <p
                  className="text-lg"
                  style={{
                    background:
                      "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",

                    display: "inline",
                  }}
                >
                  {email}
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {/* OTP Input Field */}
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-slate-300 font-medium">
                    Verification Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="text-center text-2xl tracking-[0.5em] h-16 bg-[#000825] border-slate-600/50 placeholder:text-slate-400 text-white focus:border-emerald-500 focus:ring-emerald-500 rounded-xl font-mono font-bold"
                    maxLength={6}
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Gaming Verify Button */}
                <Button
                  type="submit"
                  className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-3xl transition-all duration-300 overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                  }}
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span className="relative z-10">Verifying Access...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Verify & Enter</span>
                    </>
                  )}
                </Button>
              </form>

              {/* Resend Section */}
              <div className="mt-8 text-lg text-center flex items-center justify-center gap-2">
                <p className="text-slate-400">Didn't receive the code?</p>
                <Button
                  onClick={handleResendOTP}
                  variant="ghost"
                  className="text-violet-400 hover:text-violet-300 p-0 hover:bg-violet-500/10 font-semibold transition-all duration-300"
                  disabled={isResending}
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <span className="text-lg">Resend code</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Back Link */}
              <div className="mt-8 text-center">
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center text-slate-400 hover:text-slate-300 transition-colors font-medium"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to arena entrance
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
