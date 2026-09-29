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
import logo from "@/public/images/Primary Logo white 1.png";

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
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Top Gray Shade */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-28 sm:h-48 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />
        <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.08)_35%,transparent_70%)]" />
      </div>



      <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          {/* Premium Logo */}
          <div className="text-center">
            <div className="relative group">
              <div className="absolute inset-0 transition-opacity duration-500"></div>
              <div className="relative pt-6 pb-0">
                <Link href="/">
                  <Image
                    src={logo}
                    alt="Game of Creators"
                    width={260}
                    height={90}
                    className="mx-auto cursor-pointer"
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Enhanced Gaming Container */}
          <div className="relative group">
            {/* Gaming Glow Effect */}

            <div className="relative p-8 rounded-2xl">
              {/* Gaming Header */}
              <div className="mb-8 text-center">
                <h1 className="text-4xl md:text-5xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent drop-shadow-2xl mb-4">
                  Check Your Email
                </h1>
                <p className="text-[#8E8E8E] text-lg leading-relaxed mb-8">
                  Start your creator journey and unlock epic opportunities
                </p>
                <p className="text-[#8E8E8E] text-lg leading-relaxed mb-2">
                  We sent a 6-digit verification code to
                </p>
                <p className="text-lg text-white font-medium">
                  {email}
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {/* OTP Input Field */}
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-white font-medium text-sm">
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
                    className="text-center text-2xl tracking-[0.5em] h-16 bg-black border-white/20 placeholder:text-slate-400 text-white focus:border-white focus:ring-white focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-0 rounded-xl font-mono font-bold"
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
                  className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-xl border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] hover:bg-white/10 transition-all duration-300 overflow-hidden"
                  disabled={isLoading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
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
                <p className="text-[#8E8E8E]">Didn't receive the code?</p>
                <Button
                  onClick={handleResendOTP}
                  variant="ghost"
                  className="text-white hover:text-gray-300 p-0 hover:bg-transparent font-semibold transition-all duration-300"
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
                  className="inline-flex items-center text-[#8E8E8E] hover:text-white transition-colors font-medium"
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
