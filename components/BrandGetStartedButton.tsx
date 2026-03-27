"use client"
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonLoadingSpinner } from '@/components/loading/LoadingSpinner'
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
                // Logged in — check user type
                const { data: userData } = await supabase
                    .from('users')
                    .select('user_type')
                    .eq('id', user.id)
                    .single();

                if (userData?.user_type === 'creator') {
                    setShowCreatorModal(true);
                    return;
                }

                // Logged in as brand → go to contests
                router.push('/dashboard/contests');
                return;
            }

            // Not logged in → go to get-started
            router.push('/get-started');
        } catch {
            router.push('/get-started');
        } finally {
            setIsCheckingAccount(false);
        }
    };

    const handleSignOutAndContinueBrand = async () => {
        setIsSigningOut(true);
        try {
            await supabase.auth.signOut();
            setShowCreatorModal(false);
            router.push('/get-started');
            router.refresh();
        } catch {
            // ignore
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
                className="rounded-3xl relative bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white font-bold px-8 py-6 text-lg overflow-hidden hover:from-[#5a2ba3] hover:to-[#8f45f5] transition-all duration-300 shadow-lg"
                onClick={handleGetStartedClick}
                disabled={isCheckingAccount}
            >
                {isCheckingAccount ? <ButtonLoadingSpinner /> : <Crown className="h-4 w-4" />}
                <span>Get Started →</span>
            </Button>

            <Dialog open={showCreatorModal} onOpenChange={setShowCreatorModal}>
                <DialogContent className="bg-[#050816] border border-violet-500/30 text-white rounded-2xl shadow-2xl shadow-violet-900/40 sm:max-w-xl p-8">
                    <DialogHeader>
                        <DialogTitle className="text-xl mb-4 lg:text-2xl leading-tight font-semibold">
                            You&apos;re logged in as{" "}
                            <span style={{
                                background: "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                            }}>
                                a creator
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-base text-slate-300 leading-relaxed">
                            To continue as a brand, please sign out from your creator account first, then sign up or log in as a brand.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5"
                            onClick={handleContinueAsCreator}
                            disabled={isSigningOut}
                        >
                            {isSigningOut ? <ButtonLoadingSpinner /> : null}
                            Continue as Creator
                        </Button>
                        <Button
                            className="w-full sm:w-auto bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white hover:from-[#5a2ba3] hover:to-[#8f45f5] px-6 py-5"
                            onClick={handleSignOutAndContinueBrand}
                            disabled={isSigningOut}
                        >
                            {isSigningOut ? <ButtonLoadingSpinner /> : 'Sign out & Continue as Brand'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

