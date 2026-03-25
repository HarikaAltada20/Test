"use client";
import { ArrowRight, Rocket, ShieldCheck, Zap, CheckCircle, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CtcBanner() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [showAdvertiserModal, setShowAdvertiserModal] = useState(false);
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Route flags
  const isBrands = pathname === "/brands";
  const isCreators = pathname === "/creators";
  const isHome = pathname === "/";

  // Styles
  const styles = {
    creators: {
      bgGradient:
        "linear-gradient(180deg, #161C34 0%, rgba(231, 93, 13, 0.56) 166.78%)",
      circleColor: "border-orange-500",
      arcColor: "border-t-orange-500",
      textGradient: "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
      btnGradient: "linear-gradient(90deg, #DD7209 0%, #FF652D 100%)",
    },
    brands: {
      bgGradient: "linear-gradient(180deg, #161C34 0%, #7F39EC 166.78%)",
      circleColor: "border-purple-500",
      arcColor: "border-t-purple-500",
      textGradient: "linear-gradient(180deg, #B16FF4 33.29%, #7F39EC 81.2%)",
      btnGradient: "linear-gradient(90deg, #7F39EC 0%, #B16FF4 100%)",
    },
  };

  // Theme selection: / and /brands share the brands theme
  const theme = isCreators ? styles.creators : styles.brands;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleMainCtaClick = async () => {
    if (isHome) {
      setIsNavigating(true);
      localStorage.removeItem("signupRole");
      router.push("/auth/signup");
      return;
    }

    setIsCheckingAccount(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        const { data: userData } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", user.id)
          .single();

        if (isBrands && userData?.user_type === "creator") {
          setShowCreatorModal(true);
          return;
        }

        if (isCreators && userData?.user_type === "advertiser") {
          setShowAdvertiserModal(true);
          return;
        }
      }

      localStorage.setItem("signupRole", isBrands ? "brand" : "creator");
      router.push("/auth/signup");
    } catch (error) {
      console.error("Failed to verify account type before sign-up:", error);
      localStorage.setItem("signupRole", isBrands ? "brand" : "creator");
      router.push("/auth/signup");
    } finally {
      setIsCheckingAccount(false);
    }
  };

  const handleSignOutAndContinueCreator = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      localStorage.setItem("signupRole", "creator");
      setShowAdvertiserModal(false);
      router.push("/auth/signup");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out advertiser before creator sign-up:", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleContinueAsAdvertiser = () => {
    setShowAdvertiserModal(false);
    router.push("/dashboard/contests");
  };

  const handleSignOutAndContinueBrand = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      localStorage.setItem("signupRole", "brand");
      setShowCreatorModal(false);
      router.push("/auth/signup");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out creator before brand sign-up:", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleContinueAsCreator = () => {
    setShowCreatorModal(false);
    router.push("/dashboard/opportunities");
  };

  return (
    <section
      className="relative flex flex-col items-center justify-center min-h-[500px] text-center text-white overflow-hidden"
      ref={sectionRef}
      style={{ background: theme.bgGradient }}
    >
      {/* Background Rings */}
      <div
        className={`absolute w-[500px] h-[500px] border ${theme.circleColor}/20 rounded-full`}
      ></div>
      <div
        className={`absolute w-[700px] h-[700px] border ${theme.circleColor}/20 rounded-full`}
      ></div>
      <div
        className={`absolute w-[900px] h-[900px] border ${theme.circleColor}/20 rounded-full`}
      ></div>

      {/* Revolving arc */}
      <div className="absolute w-[900px] h-[900px] rounded-full animate-spin-slow">
        <div
          className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme.arcColor}`}
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)" }}
        ></div>
      </div>
      <div className="absolute w-[700px] h-[700px] rounded-full animate-spin-slow-reverse">
        <div
          className={`absolute inset-0 rounded-full border-[3px] border-transparent ${theme.arcColor}`}
          style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)" }}
        ></div>
      </div>

      {/* Tagline */}
      <div className="flex items-center mt-3 md:mt-0 gap-2 px-4 py-2 bg-[#2C3148] rounded-full text-lg z-10">
        <Rocket className="w-4 h-4" />
        <span>
          {isHome
            ? "Ready to go viral?"
            : isBrands
              ? "Ready to go viral?"
              : "Ready to get paid?"}
        </span>
      </div>

      {/* Main Heading */}
      <h1
        className={`mt-6 text-3xl md:text-5xl font-bold z-10 ${inView ? "slide-up" : "opacity-0 translate-y-10"
          }`}
      >
        {isHome
          ? "Join the "
          : "Ready to Transform Your "}{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: theme.textGradient }}
        >
          {isCreators
            ? "Creativity"
            : isHome
              ? "Creator Revolutions "
              : "Content Strategy"}
        </span>
        ?
      </h1>

      {/* Subtitle */}
      <p
        className={`mt-4 max-w-2xl text-xl text-gray-200 z-10 ${inView ? "slide-left" : "opacity-0 translate-x-10"
          }`}
      >
        {isHome
          ? "50,000+ creators, 1000+ brands, millions of viral moments. Your turn to dominate!"
          : isCreators
            ? "Join thousands of creators and brands. Sign up today and unlock your potential!"
            : "Launch your first contest today and witness the power of creator-generated content."}
      </p>

      {/* CTA Button */}
      <div className="flex justify-center items-center mt-12">
        <button
          type="button"
          onClick={handleMainCtaClick}
          disabled={isCheckingAccount}
          className="relative z-10 rounded-3xl text-white font-bold px-8 py-3 text-lg overflow-hidden flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          style={{ backgroundImage: theme.btnGradient }}
        >
          <div className="scan-line"></div>
          {(isNavigating || isCheckingAccount) ? <ButtonLoadingSpinner /> : <Rocket className="w-4 h-4" />}
          {isHome
            ? "Join Game Of Creators"
            : isCreators
              ? "Start Earning"
              : "Launch a Contest"}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <Dialog open={showAdvertiserModal} onOpenChange={setShowAdvertiserModal}>
        <DialogContent className="bg-[#050816] border border-orange-500/30 text-white rounded-2xl shadow-2xl shadow-orange-900/40 sm:max-w-xl p-8">
          <DialogHeader>
          <DialogTitle
              className="text-xl mb-2 lg:text-2xl leading-tight"

            >
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                 You are logged in as {" "}
              </span>
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                <span className="relative">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
                    }}
                  >
                    a brand
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl "></div>
                </span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-base md:text-lg text-slate-300 leading-relaxed">
              To continue as a creator, please sign out from your brand account first, then log in or sign up as a creator account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-slate-600 bg-transparent text-base text-md text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5"
              onClick={handleContinueAsAdvertiser}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              Continue as Brand
            </Button>
            <Button
              className="w-full sm:w-auto bg-gradient-to-r from-[#DD7209] to-[#FF652D] text-base text-md text-white hover:from-[#DD7209]/90 hover:to-[#FF652D]/90 px-6 py-5"
              onClick={handleSignOutAndContinueCreator}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              Sign out & Continue as Creator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatorModal} onOpenChange={setShowCreatorModal}>
        <DialogContent className="bg-[#050816] border border-violet-500/30 text-white rounded-2xl shadow-2xl shadow-violet-900/40 sm:max-w-xl p-8">
          <DialogHeader>
          <DialogTitle
              className="text-xl mb-4 lg:text-2xl leading-tight"
  
             
            >
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                You are logged in as {" "}
              </span>

              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                <span className="relative">
                  <span
                    style={{
                      background:
                        "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      display: "inline",
                    }}
                  >
                   a creator
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
                </span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-base md:text-lg text-slate-300 leading-relaxed">
              To continue as a brand, please sign out from your creator account first, then log in or sign up as a brand account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-slate-600 bg-transparent text-base text-md text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5"
              onClick={handleContinueAsCreator}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              Continue as Creator
            </Button>
            <Button
              className="w-full sm:w-auto bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-base text-md text-white hover:from-[#4C238B]/90 hover:to-[#7F39EC]/90 px-6 py-5"
              onClick={handleSignOutAndContinueBrand}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              Sign out & Continue as Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Buttons for Home */}
      {isHome && (
        <div className="flex flex-wrap justify-center gap-6 mt-12 z-10">
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <ShieldCheck className="w-4 h-4" /> 100% Secure
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <Zap className="w-4 h-4" /> Instant Setup
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <CheckCircle className="w-4 h-4" /> Guaranteed Results
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white rounded-full">
            <Globe className="w-4 h-4" /> Global Reach
          </div>
        </div>
      )}
    </section>
  );
}
