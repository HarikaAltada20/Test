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
import logo from "@/public/images/gold_logo_horizontal.svg";
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
    <div className="min-h-screen bg-[#000825] overflow-hidden relative">
      {/* Enhanced Background Elements - Gamified */}

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
        <Key
          className="absolute bottom-20 right-20 h-6 w-6 text-amber-400/60 animate-pulse"
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
           

            <div className="relative p-8 rounded-2xl ">
              {/* Gaming Header */}
              <div className="mb-8 text-center">
               

                <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-2xl mb-4">
                  Recover Your Access
                </h1>

                {!isSuccess && (
                  <p className="text-slate-300 text-lg leading-relaxed">
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
                    <h3 className="text-3xl font-bold text-white">
                      Recovery Portal Sent!
                    </h3>
                    <p className="text-lg mb-3 text-slate-300">
                       We've dispatched a recovery link to{" "}
                      <span className="font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {email}
                      </span>
                    </p>
                    <p className="text-slate-400 text-sm">
                      Can't find the email? Check your spam folder.
                    </p>
                  </div>

                  <Button
                   className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-3xl transition-all duration-300 overflow-hidden"
                   style={{
                     background:
                       "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                   }}
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
                      className="text-slate-300 font-medium"
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
                        className="pl-10 h-12  bg-[#000825] border-slate-600/50 placeholder:text-slate-400 text-white focus:border-amber-500 focus:ring-amber-500 rounded-xl"
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
                    className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-3xl transition-all duration-300 overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                  }}
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
                      className="text-md inline-flex items-center text-slate-200 hover:text-slate-300 transition-colors font-medium"
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
