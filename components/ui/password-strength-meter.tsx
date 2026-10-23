import React from 'react';
import { validatePassword, getPasswordStrength } from '@/lib/password-utils';
import { CheckCircle, XCircle, AlertCircle, Shield } from 'lucide-react';

interface PasswordStrengthMeterProps {
    password: string;
    className?: string;
    showRequirements?: boolean;
    variant?: "default" | "brand";
}

export function PasswordStrengthMeter({
    password,
    className = "",
    showRequirements = true,
    variant = "default",
}: PasswordStrengthMeterProps) {
    const validation = validatePassword(password);
    const strength = getPasswordStrength(password);

    // Calculate progress percentage
    const getProgressPercentage = () => {
        if (!password) return 0;

        switch (strength) {
            case 'weak': return 20;
            case 'fair': return 40;
            case 'good': return 60;
            case 'strong': return 80;
            case 'very-strong': return 100;
            default: return 0;
        }
    };

    // Get color based on strength
    const getStrengthColor = () => {
        switch (strength) {
            case 'weak': return 'text-red-500';
            case 'fair': return 'text-orange-500';
            case 'good': return 'text-yellow-500';
            case 'strong': return 'text-blue-500';
            case 'very-strong': return 'text-green-500';
            default: return 'text-gray-400';
        }
    };

    // Get progress bar color
    const getProgressColor = () => {
        switch (strength) {
            case 'weak': return 'bg-red-500';
            case 'fair': return 'bg-orange-500';
            case 'good': return 'bg-yellow-500';
            case 'strong': return 'bg-blue-500';
            case 'very-strong': return 'bg-green-500';
            default: return 'bg-gray-300';
        }
    };

    // Get strength label
    const getStrengthLabel = () => {
        switch (strength) {
            case 'weak': return 'Weak';
            case 'fair': return 'Fair';
            case 'good': return 'Good';
            case 'strong': return 'Strong';
            case 'very-strong': return 'Very Strong';
            default: return '';
        }
    };

    // Password requirements checklist
    const requirements = [
        {
            label: '8-32 characters',
            met: password.length >= 8 && password.length <= 32
        },
        {
            label: 'Uppercase letter (A-Z)',
            met: /[A-Z]/.test(password)
        },
        {
            label: 'Lowercase letter (a-z)',
            met: /[a-z]/.test(password)
        },
        {
            label: 'Number (0-9)',
            met: /[0-9]/.test(password)
        },
        {
            label: 'Special character (!@#$%^&*)',
            met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        },
        {
            label: 'No spaces',
            met: !/\s/.test(password)
        }
    ];

    if (!password) return null;

    const brand = variant === "brand";

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Strength Indicator */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${brand ? "text-[#1a1a1a]" : "text-slate-300"}`}>
                        Password Strength
                    </span>
                    <span className={`text-sm font-semibold ${brand ? "text-[#1a1a1a]" : getStrengthColor()}`}>
                        {getStrengthLabel()}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className={`w-full rounded-full h-2 overflow-hidden ${brand ? "bg-[#e6e6e8]" : "bg-slate-700"}`}>
                    <div
                        className={`h-full transition-all duration-300 ease-out ${brand ? "bg-[#1a1a1a]" : getProgressColor()}`}
                        style={{ width: `${getProgressPercentage()}%` }}
                    />
                </div>

                {/* Strength Indicators */}
                <div className="flex justify-between">
                    {['weak', 'fair', 'good', 'strong', 'very-strong'].map((level, index) => (
                        <div
                            key={level}
                            className={`w-2 h-2 rounded-full transition-colors duration-200 ${getProgressPercentage() > index * 20
                                    ? (brand ? "bg-[#1a1a1a]" : getProgressColor())
                                    : (brand ? "bg-[#d4d4d8]" : "bg-slate-600")
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Requirements Checklist */}
            {showRequirements && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${brand ? "text-[#1a1a1a]" : "text-slate-400"}`} />
                        <span className={`text-sm font-medium ${brand ? "text-[#1a1a1a]" : "text-slate-300"}`}>
                            Security Requirements
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                        {requirements.map((req, index) => (
                            <div key={index} className="flex items-center gap-2">
                                {req.met ? (
                                    <CheckCircle className={`h-3.5 w-3.5 flex-shrink-0 ${brand ? "text-[#1a1a1a]" : "text-green-500"}`} />
                                ) : (
                                    <XCircle className={`h-3.5 w-3.5 flex-shrink-0 ${brand ? "text-[#a1a1aa]" : "text-slate-500"}`} />
                                )}
                                <span className={`text-xs ${brand
                                    ? (req.met ? "text-[#1a1a1a]" : "text-[#8d8d95]")
                                    : (req.met ? "text-green-400" : "text-slate-400")
                                    }`}>
                                    {req.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Additional Security Tips */}
                    {password && !validation.isValid && validation.errors.includes("Password is too common or easily guessable") && (
                        <div className={`flex items-start gap-2 mt-2 p-2 rounded-md border ${brand ? "bg-[#f3f3f5] border-[#e6e6e8]" : "bg-orange-500/10 border-orange-500/20"}`}>
                            <AlertCircle className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${brand ? "text-[#1a1a1a]" : "text-orange-500"}`} />
                            <span className={`text-xs ${brand ? "text-[#1a1a1a]" : "text-orange-400"}`}>
                                Avoid common passwords like "password123" or "qwerty". Try using a unique combination!
                            </span>
                        </div>
                    )}

                    {password && !validation.isValid && validation.errors.some(err =>
                        err.includes("sequential patterns") || err.includes("repeated characters")
                    ) && (
                            <div className={`flex items-start gap-2 mt-2 p-2 rounded-md border ${brand ? "bg-[#f3f3f5] border-[#e6e6e8]" : "bg-blue-500/10 border-blue-500/20"}`}>
                                <AlertCircle className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${brand ? "text-[#1a1a1a]" : "text-blue-500"}`} />
                                <span className={`text-xs ${brand ? "text-[#1a1a1a]" : "text-blue-400"}`}>
                                    Avoid patterns like "abc123" or "aaa111". Mix up your characters for better security!
                                </span>
                            </div>
                        )}
                </div>
            )}

            {/* Success Message */}
            {validation.isValid && strength === 'very-strong' && (
                <div className={`flex items-center gap-2 p-2 rounded-md border ${brand ? "bg-[#f3f3f5] border-[#e6e6e8]" : "bg-green-500/10 border-green-500/20"}`}>
                    <CheckCircle className={`h-4 w-4 ${brand ? "text-[#1a1a1a]" : "text-green-500"}`} />
                    <span className={`text-sm font-medium ${brand ? "text-[#1a1a1a]" : "text-green-400"}`}>
                        Excellent! Your password is very secure. 🛡️
                    </span>
                </div>
            )}
        </div>
    );
} 