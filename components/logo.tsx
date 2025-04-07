interface LogoProps {
    centered?: boolean;
    showText?: boolean;
}

export function Logo({ centered = false, showText = true }: LogoProps) {
    return (
        <div className={`flex items-center ${centered ? 'justify-center' : ''}`}>
            <div className="relative">
                <div className="rounded-full bg-[#f0fdf4] p-6 flex items-center justify-center">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 120 120"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M85 35L60 70L35 35"
                            stroke="#f43f5e"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d="M35 65L60 30L85 65"
                            stroke="#0ea5e9"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle cx="60" cy="80" r="15" fill="#8b5cf6" />
                    </svg>
                </div>
            </div>
            {showText && <span className="font-bold text-xl ml-3">Go Viral</span>}
        </div>
    )
} 