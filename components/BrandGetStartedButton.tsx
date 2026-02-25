"use client"
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'

export default function BrandGetStartedButton() {
    const router = useRouter();
    const supabase = createClient();
    const [showCreatorModal, setShowCreatorModal] = useState(false);
    const [isCheckingAccount, setIsCheckingAccount] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleGetStartedClick = async () => {
        setIsCheckingAccount(true);

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (!userError && user) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('user_type')
                    .eq('id', user.id)
                    .single();

                if (userData?.user_type === 'creator') {
                    setShowCreatorModal(true);
                    return;
                }
            }

            localStorage.setItem('signupRole', 'brand');
            router.push('/auth/signup');
        } catch (error) {
            console.error('Failed to verify account type before brand sign-up:', error);
            localStorage.setItem('signupRole', 'brand');
            router.push('/auth/signup');
        } finally {
            setIsCheckingAccount(false);
        }
    };

    const handleSignOutAndContinueBrand = async () => {
        setIsSigningOut(true);
        try {
            await supabase.auth.signOut();
            localStorage.setItem('signupRole', 'brand');
            setShowCreatorModal(false);
            router.push('/auth/signup');
            router.refresh();
        } catch (error) {
            console.error('Failed to sign out creator before brand sign-up:', error);
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleContinueAsCreator = () => {
        setShowCreatorModal(false);
        router.push('/dashboard/opportunities');
    };

    return (
        <>
            <Button
                className="rounded-3xl relative bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white font-bold px-8 py-6 text-lg overflow-hidden hover:from-[#4C238B]/90 hover:to-[#7F39EC]/90 transition-all duration-300 shadow-lg"
                onClick={handleGetStartedClick}
                disabled={isCheckingAccount}
            >
                <Crown className="h-4 w-4" />
                <span>Get Started →</span>
            </Button>

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
                    <DialogFooter className="mt-4 flex-col gap-4 sm:flex-row sm:justify-center">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto border-slate-600 bg-transparent text-base text-md text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5"
                            onClick={handleContinueAsCreator}
                            disabled={isSigningOut}
                        >
                            Continue as Creator
                        </Button>
                        <Button
                            className="w-full sm:w-auto bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-base text-md text-white hover:from-[#4C238B]/90 hover:to-[#7F39EC]/90 px-6 py-5"
                            onClick={handleSignOutAndContinueBrand}
                            disabled={isSigningOut}
                        >
                            Sign out & Continue as Brand
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
} 