"use client"
import { useRouter } from 'next/navigation'
import { Crown, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BrandGetStartedButton() {
    const router = useRouter();

    return (
        <Button
            size="lg"
            className="rounded-3xl relative text-white text-white font-bold px-8 py-6 text-lg overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, #4C238B 0%, #7F39EC 50%, #4C238B 100%)",
            }}
            onClick={() => {
                localStorage.setItem('signupRole', 'brand');
                router.push('/auth/signup');
            }}
        >
             <div className="scan-line"></div>
            <Crown className="mr-1 h-8 w-8" size={18} />
            <span className="relative z-10">Get Started</span>
            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
    );
} 