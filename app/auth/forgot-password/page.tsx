"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Shield,
  Crown,
  Trophy,
  Star,
  Sparkles,
  Key,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import logo from "@/public/images/Primary Logo white 1.png";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase(); // Normalize email

      // 1. Check if the email exists in your public users table
      const { data: userExists, error: checkError } = await supabase
        .from("users") // Your public users table name
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116: no rows found, not an error for this check
        console.error("Error checking email existence:", checkError);
        setError("Could not verify email. Please try again later.");
        toast({
          variant: "destructive",
          title: "Verification Error",
          description: "Could not verify your email. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      if (!userExists) {
        setError(
          "No account found with this email address. Please ensure you entered it correctly or register for an account."
        );
        toast({
          variant: "destructive",
          title: "Champion Not Found",
          description: "No account found with this email address.",
          duration: 6000,
        });
        setIsLoading(false);
        return;
      }

      // 2. If email exists, proceed to send reset link
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${
            typeof window !== "undefined" ? window.location.origin : ""
          }/auth/reset-password`,
        }
      );

      if (resetError) throw resetError;

      setIsSuccess(true);
      toast({
        title: "Reset Link Dispatched! 🚀",
        description: "Check your email for the password reset portal.",
        duration: 5000,
      });
    } catch (err: any) {
      setError(err.message || "Failed to send reset password email");
      toast({
        variant: "destructive",
        title: "Dispatch Failed",
        description: err.message || "Failed to send reset password email",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Enhanced Background Elements - Gamified */}



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
           

            <div className="relative p-8 rounded-2xl ">
              {/* Gaming Header */}
              <div className="mb-8 text-center">
               

                <h1 className="text-3xl md:text-4xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent drop-shadow-2xl mb-4">
                  Recover Your Access
                </h1>

                {!isSuccess && (
                  <p className="text-[#8E8E8E] text-lg leading-relaxed">
                    Enter your email to receive arena access recovery
                  </p>
                )}
              </div>

              {isSuccess ? (
                <div className="text-center space-y-6">
                  {/* Success Icon */}
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full blur-xl opacity-60 animate-pulse"></div>
                    <div className="relative w-full h-full bg-[#74da7f] rounded-full flex items-center justify-center ">
                      <CheckCircle className="h-12 w-12 text-white" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-3xl font-bold bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent">
                      Recovery Portal Sent!
                    </h3>
                    <p className="text-lg mb-3 text-[#8E8E8E]">
                       We've dispatched a recovery link to{" "}
                      <span className="font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {email}
                      </span>
                    </p>
                    <p className="text-[#8E8E8E] text-sm">
                      Can't find the email? Check your spam folder.
                    </p>
                  </div>

                  <Button
                   className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-xl border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] hover:bg-white/10 transition-all duration-300 overflow-hidden"
                    asChild
                  >
                    <Link href="/auth/signin">
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                      <div className="relative z-10 flex items-center justify-center gap-3">
                       
                        <span>Return to Arena</span>
                       
                      </div>
                    </Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-10 mb-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-white font-medium"
                    >
                      Email Address
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 bg-black border-white/20 placeholder:text-[#8E8E8E] text-white focus:border-white focus:ring-white focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-0 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Gaming Recovery Button */}
                  <Button
                    type="submit"
                    className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-xl border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] hover:bg-white/10 transition-all duration-300 overflow-hidden"
                    disabled={isLoading}
                  >
                  
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span className="relative z-10">
                          Dispatching Recovery...
                        </span>
                      </>
                    ) : (
                      <>
                        
                        <span className="relative z-10">
                          Send Recovery Portal
                        </span>
                       
                      </>
                    )}
        </Button>

                  {/* Back Link */}
                  <div className="text-center pt-4">
                    <Link
                      href="/auth/signin"
                      className="text-md inline-flex items-center text-[#8E8E8E] hover:text-slate-300 transition-colors font-medium"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Return to arena entrance
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
