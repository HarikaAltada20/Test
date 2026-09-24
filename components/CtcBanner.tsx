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
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";

export default function CtcBanner() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isLight } = useThemeMode();
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
      className={cn(
        "relative flex flex-col items-center justify-center min-h-[320px] md:min-h-[380px] text-center overflow-hidden transition-colors duration-300",
        isLight
          ? "bg-[#F1F1F1] text-black"
          : "bg-black text-white",
      )}
      ref={sectionRef}
    >
      {isHome ? (
        <>
          <div className="relative z-10 flex flex-col items-center px-4 w-full">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
                isLight
                  ? "border-black/[0.06] bg-white text-black/55 shadow-sm"
                  : "border-white/10 bg-white/5 text-zinc-200",
              )}
            >
              <ShieldCheck
                className={cn(
                  "h-4 w-4",
                  isLight ? "text-black/45" : "text-zinc-200",
                )}
              />
              Pay for Performance
            </div>

            <div className="relative mt-3 flex flex-col items-center justify-center w-full max-w-[780px] py-10 sm:py-12 md:py-14">
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] md:w-[500px] md:h-[500px] rounded-full border",
                  isLight ? "border-black/[0.08]" : "border-white/[0.08]",
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] sm:w-[540px] sm:h-[540px] md:w-[640px] md:h-[640px] rounded-full border",
                  isLight ? "border-black/[0.06]" : "border-white/[0.06]",
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] sm:w-[660px] sm:h-[660px] md:w-[780px] md:h-[780px] rounded-full border",
                  isLight ? "border-black/[0.04]" : "border-white/[0.04]",
                )}
              />

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

              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-[36%] z-0 h-[180px] w-[180px] sm:h-[220px] sm:w-[220px] md:h-[400px] md:w-[400px] -translate-x-1/2 -translate-y-1/2 rotate-[25.29deg]",
                  isLight ? "opacity-40" : "opacity-85",
                )}
              >
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
  className={cn(
    `relative z-10 flex flex-col items-center text-center text-3xl font-['Inter'] font-bold md:text-[52px] leading-[110%] tracking-[-4%] text-center ${
      inView ? "" : "opacity-0 translate-y-10"
    }`,
    isLight ? "text-black" : "bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,#FFFFFF_0%,#999999_100%)] bg-clip-text text-transparent",
  )}

>
  <span className="block">Brands Get Results.</span>
  <span className="mt-1 block">Creators Get Rewarded.</span>
</h2>

              <div className="relative z-10 mt-5 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsNavigating(true);
                    router.push("/brands");
                  }}
                  disabled={isNavigating}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-12 py-3 text-sm sm:text-base font-medium transition-colors disabled:opacity-70",
                    isLight
                      ? "bg-black text-white hover:bg-black/90"
                      : "border border-white/25 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] text-white hover:bg-white/10",
                  )}
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
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-12 py-3 text-sm sm:text-base font-medium transition-colors disabled:opacity-70",
                    isLight
                      ? "border border-black/10 bg-white text-black hover:bg-white shadow-[0_8px_24px_rgba(15,15,30,0.06)]"
                      : "bg-[#F0E6F6] text-black hover:bg-zinc-100",
                  )}
                >
                  {isNavigating ? <ButtonLoadingSpinner /> : null}
                  For Creators →
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 flex flex-col items-center px-4 w-full">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
                isLight
                  ? "border-black/[0.06] bg-white text-black/55 shadow-sm"
                  : "border-white/10 bg-white/5 text-zinc-200",
              )}
            >
              <ShieldCheck
                className={cn(
                  "h-4 w-4",
                  isLight ? "text-black/45" : "text-zinc-200",
                )}
              />
              Pay for Performance
            </div>

            {/* Static circles around heading + buttons */}
            <div className="relative mt-3 flex flex-col items-center justify-center w-full max-w-[780px] py-10 sm:py-12 md:py-14">
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] md:w-[500px] md:h-[500px] rounded-full border",
                  isLight ? "border-black/[0.08]" : "border-white/[0.08]",
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] sm:w-[540px] sm:h-[540px] md:w-[640px] md:h-[640px] rounded-full border",
                  isLight ? "border-black/[0.06]" : "border-white/[0.06]",
                )}
              />
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] sm:w-[660px] sm:h-[660px] md:w-[780px] md:h-[780px] rounded-full border",
                  isLight ? "border-black/[0.04]" : "border-white/[0.04]",
                )}
              />

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

              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-[36%] z-0 h-[180px] w-[180px] sm:h-[220px] sm:w-[220px] md:h-[400px] md:w-[400px] -translate-x-1/2 -translate-y-1/2 rotate-[25.29deg]",
                  isLight ? "opacity-40" : "opacity-85",
                )}
              >
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
  className={cn(
    `relative z-10 flex flex-col items-center text-center text-3xl font-['Inter'] font-bold md:text-[52px] leading-[110%] tracking-[-4%] text-center ${
      inView ? "" : "opacity-0 translate-y-10"
    }`,
    isLight ? "text-black" : "bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,#FFFFFF_0%,#999999_100%)] bg-clip-text text-transparent",
  )}

>
  {isBrands ? (
    <>
      <span>Run campaigns</span>
      <span className="mt-1">that drive results.</span>
    </>
  ) : (
    <span>Start Earning as a Creator</span>
  )}
</h2>

              <div className="relative z-10 mt-5 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                {isBrands ? (
                  <button
                    type="button"
                    onClick={handleMainCtaClick}
                    disabled={isNavigating || isCheckingAccount}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm sm:text-base font-medium transition-colors disabled:opacity-70",
                      isLight
                        ? "bg-black text-white hover:bg-black/90"
                        : "border border-white/25 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)]  text-white hover:bg-white/10",
                    )}
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
                   className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm sm:text-base font-medium transition-colors disabled:opacity-70",
                      isLight
                        ? "bg-black text-white hover:bg-black/90"
                        : "border border-white/25 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)]  text-white hover:bg-white/10",
                    )}
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
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-12 py-3 text-sm sm:text-base font-medium transition-colors",
                    isLight
                      ? "border border-black/10 bg-white text-black hover:bg-white shadow-[0_8px_24px_rgba(15,15,30,0.06)]"
                      : "bg-[#F0E6F6] text-black hover:bg-zinc-100",
                  )}
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
