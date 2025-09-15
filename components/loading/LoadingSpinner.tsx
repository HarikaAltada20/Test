"use client";

import React from "react";
import Image from "next/image";
import lightLogo from "@/public/images/Group (2).avif";
import darkLogo from "@/public/images/Group (3).avif";

interface LoadingSpinnerProps {
    mode?: "light" | "dark"; 
  }
  
  const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ mode = "light" }) => {
    const logo = mode === "dark" ? darkLogo : lightLogo;
  
    return (
      <div className="flex items-center justify-center">
        <div className="relative">
          {/* Outermost Rotating Square Border - Clockwise - Blue */}
          <div className="w-32 h-32 border-4 border-purple-200 rounded-2xl animate-spin"></div>
  
          {/* Second Square Border - Counter-clockwise - Purple */}
          {/* <div
            className="absolute inset-2 w-28 h-28 border-2 border-purple-400 rounded-2xl animate-spin"
            style={{ animationDirection: "reverse" }}
          ></div> */}
  
          
          {/* <div className="absolute inset-4 w-24 h-24 border-2 border-purple-300 rounded-xl animate-spin"></div> */}
  
        
          <div
            className="absolute inset-6 w-20 h-20 border-2 border-purple-600 rounded-xl animate-spin"
            style={{ animationDirection: "reverse" }}
          ></div>
  
          {/* Center Logo/Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 flex items-center justify-center">
              <Image
                src={logo}
                alt="Game Of Creators"
                width={100}
                height={100}
                className="h-[50px] w-auto transition-all duration-300"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  export default LoadingSpinner;
  
  // Page-level loading component
  export function PageLoadingSpinner({ mode = "light" }: LoadingSpinnerProps) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner mode={mode} />
      </div>
    );
  }

// Inline loading for buttons
export function ButtonLoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
