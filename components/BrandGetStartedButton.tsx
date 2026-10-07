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
            await supabase.auth.signOut({ scope: 'local' });
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
                className="rounded-3xl relative inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white font-bold px-8 py-6 text-lg overflow-hidden hover:from-[#5a2ba3] hover:to-[#8f45f5] transition-all duration-300 shadow-lg"
                onClick={handleGetStartedClick}
                disabled={isCheckingAccount}
            >
                {isCheckingAccount ? <ButtonLoadingSpinner /> : <Crown className="h-4 w-4" />}
                <span>Get Started →</span>
            </Button>

            <Dialog open={showCreatorModal} onOpenChange={setShowCreatorModal}>
                <DialogContent className="bg-[#0A0A0A] border border-white/10 text-white rounded-2xl shadow-2xl sm:max-w-xl p-8">
                    <DialogHeader>
                        <DialogTitle className="bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-xl mb-4 lg:text-2xl leading-tight font-semibold">
                            You&apos;re logged in as{" "}
                            <span >
                                a creator
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-base text-slate-400 leading-relaxed">
                            To continue as a brand, please sign out from your creator account first, then sign up or log in as a brand.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button
                            variant="outline"
                            className="inline-flex w-full items-center justify-center gap-2 bg-white border border-white text-black px-6 py-5 sm:w-auto"
                            onClick={handleContinueAsCreator}
                            disabled={isSigningOut}
                        >
                            {isSigningOut ? <ButtonLoadingSpinner /> : null}
                            <span>Continue as Creator</span>
                        </Button>
                        <Button
                            className="inline-flex w-full items-center justify-center gap-2 border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] text-white px-6 py-5 sm:w-auto"
                            onClick={handleSignOutAndContinueBrand}
                            disabled={isSigningOut}
                        >
                            {isSigningOut ? <ButtonLoadingSpinner /> : null}
                            <span>Sign out & Continue as Brand</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

