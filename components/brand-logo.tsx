import React, { memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import brandLogo from '@/public/images/GoViral_transparent_logo.png'

interface BrandLogoProps {
    centered?: boolean;
    showText?: boolean;
    size?: 'sm' | 'md' | 'lg';
    href?: string;
}

// Extract LogoContent outside the main component to prevent recreation on every render
const LogoContent = ({ centered, showText, size, logoWidth, logoHeight }: {
    centered: boolean;
    showText: boolean;
    size: 'sm' | 'md' | 'lg';
    logoWidth: number;
    logoHeight: number;
}) => (
    <div className={`flex items-center ${centered ? 'justify-center' : ''}`}>
        <div className="relative">
            <div className={`rounded-full bg-[#f0fdf4] ${size === 'sm' ? 'p-3' : size === 'md' ? 'p-4' : 'p-6'} flex items-center justify-center`}>
                {/* You can replace this with your transparent logo image */}
                <Image
                    src={brandLogo}
                    alt="Game Of Creators"
                    width={logoWidth}
                    height={logoHeight}
                    priority
                />
            </div>
        </div>
        {showText && (
            <span className={`font-bold ml-3 ${size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'}`}>
                Game Of Creators
            </span>
        )}
    </div>
);

// Memoize the BrandLogo component to prevent unnecessary re-renders
export const BrandLogo = memo(function BrandLogo({
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

    if (href) {
        return (
            <Link href={href} className="focus:outline-none">
                <LogoContent
                    centered={centered}
                    showText={showText}
                    size={size}
                    logoWidth={logoWidth}
                    logoHeight={logoHeight}
                />
            </Link>
        );
    }

    return (
        <LogoContent
            centered={centered}
            showText={showText}
            size={size}
            logoWidth={logoWidth}
            logoHeight={logoHeight}
        />
    );
}); 