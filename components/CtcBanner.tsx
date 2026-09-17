"use client";
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
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
      await supabase.auth.signOut({ scope: "local" });
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
      await supabase.auth.signOut({ scope: "local" });
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
      className="relative flex flex-col items-center justify-center min-h-[420px] md:min-h-[480px] text-center text-white overflow-hidden bg-black py-16 md:py-20"
      ref={sectionRef}
    >
      {isHome ? (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* <div className="absolute left-[8%] top-[8%] h-[420px] w-[420px] rounded-full border border-[#FF6A1A]/25" />
            <div className="absolute right-[6%] top-[18%] h-[520px] w-[520px] rounded-full border border-violet-500/25" /> */}
            <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 opacity-70">
              <Image
                src="/images/attach-money.png"
                alt=""
                fill
                className="object-contain"
                sizes="280px"
              />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center px-4 w-full max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">
              <ShieldCheck className="h-4 w-4" />
              Pay for Performance
            </div>

            <h2
              className={`mt-8 text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-center leading-tight ${
                inView ? "slide-up" : "opacity-0 translate-y-10"
              }`}
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Brands Get Results.
              <br />
              Creators Get Rewarded.
            </h2>

            <div className="mt-10 flex w-full max-w-[480px] flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsNavigating(true);
                  router.push("/brands");
                }}
                disabled={isNavigating}
                className="inline-flex h-[52px] w-full sm:flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-gradient-to-b from-white/[0.08] to-transparent px-6 text-sm sm:text-base font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-70"
              >
                {isNavigating ? <ButtonLoadingSpinner /> : null}
                For Brands →
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNavigating(true);
                  router.push("/creators");
                }}
                disabled={isNavigating}
                className="inline-flex h-[52px] w-full sm:flex-1 items-center justify-center gap-2 rounded-2xl bg-[#EDE4F5] px-6 text-sm sm:text-base font-semibold text-[#1a1224] hover:bg-white transition-colors disabled:opacity-70"
              >
                {isNavigating ? <ButtonLoadingSpinner /> : null}
                For Creators →
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 flex flex-col items-center px-4 w-full">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">
              <ShieldCheck className="h-4 w-4" />
              Pay for Performance
            </div>

            {/* Static circles around heading + buttons */}
            <div className="relative mt-10 flex flex-col items-center justify-center w-full max-w-[780px] py-16 sm:py-20 md:py-24">
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] md:w-[500px] md:h-[500px] rounded-full border border-white/[0.08]" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] sm:w-[540px] sm:h-[540px] md:w-[640px] md:h-[640px] rounded-full border border-white/[0.06]" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] sm:w-[660px] sm:h-[660px] md:w-[780px] md:h-[780px] rounded-full border border-white/[0.04]" />

              {/* Static orange→purple arc highlight */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] sm:w-[540px] sm:h-[540px] md:w-[640px] md:h-[640px] rounded-full"
                style={{
                  background:
                    "conic-gradient(from 10deg, transparent 0deg, transparent 40deg, rgba(255,106,26,0.85) 70deg, rgba(168,85,247,0.85) 110deg, transparent 140deg, transparent 360deg)",
                  maskImage:
                    "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
                  WebkitMaskImage:
                    "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
                }}
              />

              <div className="pointer-events-none absolute left-1/2 top-[36%] z-0 h-[180px] w-[180px] sm:h-[220px] sm:w-[220px] md:h-[300px] md:w-[300px] -translate-x-1/2 -translate-y-1/2 opacity-85">
                <Image
                  src="/images/attach-money.png"
                  alt=""
                  fill
                  className="object-contain"
                  sizes="260px"
                  priority
                />
              </div>

              <h2
                className={`relative z-10 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-center ${
                  inView ? "slide-up" : "opacity-0 translate-y-10"
                }`}
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                {isBrands ? (
                  <>
                    Run campaigns
                    <br />
                    that drive results.
                  </>
                ) : (
                  "Start Earning as a Creator"
                )}
              </h2>

              <div className="relative z-10 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                {isBrands ? (
                  <button
                    type="button"
                    onClick={handleMainCtaClick}
                    disabled={isNavigating || isCheckingAccount}
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black px-6 py-3 text-sm sm:text-base font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-70"
                  >
                    {isNavigating || isCheckingAccount ? (
                      <ButtonLoadingSpinner />
                    ) : null}
                    Launch a Campaign →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNavigating(true);
                      router.push("/dashboard/opportunities");
                    }}
                    disabled={isNavigating || isCheckingAccount}
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-transparent px-6 py-3 text-sm sm:text-base font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-70"
                  >
                    {isNavigating || isCheckingAccount ? (
                      <ButtonLoadingSpinner />
                    ) : null}
                    Browse Campaigns →
                  </button>
                )}
                <a
                  href="https://calendly.com/guptavishesh2/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm sm:text-base font-medium text-black hover:bg-zinc-100 transition-colors"
                >
                  Talk to team →
                </a>
              </div>
            </div>
          </div>
        </>
      )}

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
              className="inline-flex w-full items-center justify-center gap-2 border-slate-600 bg-transparent text-base text-md text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5 sm:w-auto"
              onClick={handleContinueAsAdvertiser}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              <span>Continue as Brand</span>
            </Button>
            <Button
              className="inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#DD7209] to-[#FF652D] text-base text-md text-white hover:from-[#DD7209]/90 hover:to-[#FF652D]/90 px-6 py-5 sm:w-auto"
              onClick={handleSignOutAndContinueCreator}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              <span>Sign out & Continue as Creator</span>
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
              className="inline-flex w-full items-center justify-center gap-2 border-slate-600 bg-transparent text-base text-md text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5 sm:w-auto"
              onClick={handleContinueAsCreator}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              <span>Continue as Creator</span>
            </Button>
            <Button
              className="inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-base text-md text-white hover:from-[#4C238B]/90 hover:to-[#7F39EC]/90 px-6 py-5 sm:w-auto"
              onClick={handleSignOutAndContinueBrand}
              disabled={isSigningOut}
            >
              {isSigningOut ? <ButtonLoadingSpinner /> : null}
              <span>Sign out & Continue as Brand</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
