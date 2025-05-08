"use client";

import { BrandLogo } from "@/components/brand-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  // Check if user was redirected after verification
  //   useEffect(() => {
  //     const verification = searchParams.get("verification");
  //     if (verification === "pending") {
  //       toast({
  //         title: "Verification Email Sent",
  //         description:
  //           "Please check your email and verify your account before signing in.",
  //         duration: 6000, // 6 seconds
  //       });
  //     }
  //   }, [searchParams, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (data.user) {
        toast({
          title: "Success!",
          description: "You've been signed in successfully.",
          duration: 3000, // 3 seconds
        });

        // Delay navigation to dashboard to ensure toast is visible
        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      } else {
        setError(error?.message || "Failed to sign in");
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description:
            error?.message ||
            "Failed to sign in. Please check your credentials.",
          duration: 5000, // 5 seconds
        });
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to sign in",
        duration: 5000, // 5 seconds
      });
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/auth/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 pr-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            onClick={togglePasswordVisibility}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-rose-600 hover:bg-rose-700"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <BrandLogo centered showText={false} size="lg" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Sign In
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-primary font-medium hover:underline"
              >
                Get started
              </Link>
            </p>
          </div>

          <SignInForm />
        </div>
      </div>
    </div>
  );
}
