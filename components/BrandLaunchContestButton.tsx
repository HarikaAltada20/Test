"use client"
import { useRouter } from 'next/navigation'
import { Rocket, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BrandLaunchContestButton() {
    const router = useRouter();

    return (
        <Button
            size="lg"
            className="group relative bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold px-10 py-5 rounded-2xl shadow-2xl shadow-violet-500/40 hover:shadow-violet-500/60 transition-all duration-300 hover:scale-110 border border-violet-400/30 text-lg overflow-hidden"
            onClick={() => {
                localStorage.setItem('signupRole', 'brand');
                router.push('/auth/signup');
            }}
        >
            <Rocket className="mr-3 h-5 w-5" />
            <span className="relative z-10">Launch a Campaign</span>
            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-2" />
        </Button>
    );
} 