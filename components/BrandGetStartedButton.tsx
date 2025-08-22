"use client"
import { useRouter } from 'next/navigation'
import { Crown, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BrandGetStartedButton() {
    const router = useRouter();

    return (
        <Button
            className="rounded-3xl relative bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white font-bold px-8 py-6 text-lg overflow-hidden hover:from-[#4C238B]/90 hover:to-[#7F39EC]/90 transition-all duration-300 shadow-lg"
            onClick={() => {
                localStorage.setItem('signupRole', 'brand');
                router.push('/auth/signup');
            }}
        >
            <Crown className="h-4 w-4" />
            <span>Get Started →</span>
        </Button>
    );
} 