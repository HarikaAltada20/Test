"use client";

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Mail, Loader2, Lock, Eye, EyeOff, Crown, Trophy, Star, Sparkles, Shield, Gamepad2 } from "lucide-react"
import Link from "next/link"
import { FcGoogle } from "react-icons/fc"
import { useRouter } from 'next/navigation'
import Image from "next/image"
import logo from "@/public/images/gold_logo_vertical.svg"

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  // Handle email/password sign-in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!email || !password) {
      setError('Please enter both email and password')
      setIsLoading(false)
      return
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      })

      if (signInError) {
        throw signInError
      }

      if (!data.user) {
        throw new Error('Sign in failed - no user data returned')
      }

      // Record login IP
      try {
        const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
        await fetch('/api/login-ip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: data.user.id, user_agent: userAgent }),
        });
      } catch (err) {
        console.warn('Failed to record login IP:', err);
      }

      toast({
        title: "Welcome back, Champion!",
        description: "You have successfully entered the arena.",
        duration: 3000,
      })

      // Navigate to dashboard and refresh to update layout with new auth state
      router.push('/dashboard')
      router.refresh()

    } catch (err: any) {
      console.error('Email sign-in error:', err)
      let errorMessage = 'Failed to sign in. Please try again.'

      if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.'
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address before signing in.'
      }

      setError(errorMessage)
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Google OAuth sign-in
  const handleGoogleSignIn = async () => {
    setError(null)
    setIsGoogleLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (signInError) {
        throw signInError
      }

      // OAuth redirect will handle the rest
    } catch (err: any) {
      console.error("Google sign-in error:", err)
      setError(err.message || "Failed to sign in with Google")
      toast({
        variant: "destructive",
        title: "Google Access Failed",
        description: err.message || "Failed to sign in with Google. Please try again.",
        duration: 5000,
      })
      setIsGoogleLoading(false)
    }
  }

  return (
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
        <Shield className="absolute top-60 left-40 h-7 w-7 text-cyan-400/60 animate-bounce" style={{ animationDelay: '5s' }} />
        <Gamepad2 className="absolute bottom-20 right-20 h-6 w-6 text-violet-400/60 animate-pulse" style={{ animationDelay: '2.5s' }} />
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
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 backdrop-blur-sm border border-emerald-400/30 rounded-full px-4 py-2 mb-4 shadow-xl shadow-emerald-500/20">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    SECURE ACCESS
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-2xl mb-4">
                  <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Welcome
                  </span>{" "}
                  <span className="text-white">Back</span>{" "}
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                    Champion
                  </span>
                </h1>
                <p className="text-slate-300 leading-relaxed">
                  🏆 Enter your credentials to access the Game Of Creators arena
                </p>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-slate-900/70 border-slate-600/50 placeholder:text-slate-500 text-white focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                      required
                      disabled={isLoading || isGoogleLoading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300 font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-12 h-12 bg-slate-900/70 border-slate-600/50 placeholder:text-slate-500 text-white focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                      required
                      disabled={isLoading || isGoogleLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="flex justify-end">
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-violet-400 hover:text-violet-300 underline transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Gaming Sign In Button */}
                <Button
                  type="submit"
                  className="group relative w-full bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 hover:from-emerald-500 hover:via-cyan-500 hover:to-blue-500 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:scale-105 border border-emerald-400/30 overflow-hidden"
                  disabled={isLoading || isGoogleLoading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span className="relative z-10">Accessing Arena...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-5 w-5" />
                      <span className="relative z-10">Enter Arena</span>
                      <Crown className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full bg-slate-600/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gradient-to-br from-slate-800/80 to-slate-700/60 px-4 text-slate-400 font-medium">OR</span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                className="group relative w-full bg-slate-900/50 border-2 border-slate-600/50 text-white hover:text-white hover:bg-slate-800/70 hover:border-violet-400/50 backdrop-blur-sm font-bold px-8 py-4 text-lg rounded-xl transition-all duration-300 hover:scale-105"
                disabled={isLoading || isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <FcGoogle className="mr-3 h-6 w-6" />
                    <span>Continue with Google</span>
                    <Sparkles className="ml-3 h-5 w-5 text-violet-400" />
                  </>
                )}
              </Button>

              {/* Sign Up Link */}
              <div className="mt-8 text-center">
                <p className="text-slate-400">
                  New to the arena?{' '}
                  <Link
                    href="/auth/signup"
                    className="font-semibold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent hover:from-violet-300 hover:to-purple-300 transition-all"
                  >
                    Join the game
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
