import Image from 'next/image'
import Link from 'next/link'
import brandLogo from '@/public/images/GoViral_transparent_logo.png'

interface BrandLogoProps {
    centered?: boolean;
    showText?: boolean;
    size?: 'sm' | 'md' | 'lg';
    href?: string;
}

export function BrandLogo({
    centered = false,
    showText = true,
    size = 'md',
    href = '/'
}: BrandLogoProps) {
    const logoSizes = {
        sm: 32,
        md: 48,
        lg: 64
    };

    const logoWidth = logoSizes[size];
    const logoHeight = logoSizes[size];

    const LogoContent = () => (
        <div className={`flex items-center ${centered ? 'justify-center' : ''}`}>
            <div className="relative">
                <div className={`rounded-full bg-[#f0fdf4] ${size === 'sm' ? 'p-3' : size === 'md' ? 'p-4' : 'p-6'} flex items-center justify-center`}>
                    {/* You can replace this with your transparent logo image */}
                    <Image
                        src={brandLogo}
                        alt="Go Viral"
                        width={logoWidth}
                        height={logoHeight}
                        priority
                    />
                </div>
            </div>
            {showText && (
                <span className={`font-bold ml-3 ${size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'}`}>
                    Go Viral
                </span>
            )}
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="focus:outline-none">
                <LogoContent />
            </Link>
        );
    }

    return <LogoContent />;
} 