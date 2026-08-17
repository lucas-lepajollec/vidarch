import React from 'react';

interface VidArchLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VidArchLogo: React.FC<VidArchLogoProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const iconDimensions = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  }[size];

  const textDimensions = {
    sm: 'text-base',
    md: 'text-lg tracking-tight',
    lg: 'text-2xl tracking-tighter',
  }[size];

  return (
    <div className={`flex items-center gap-2 select-none group cursor-pointer ${className}`}>
      {/* Custom Distinctive VidArch Media Emblem */}
      <div className={`relative ${iconDimensions} flex-shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_10px_rgba(255,0,51,0.35)] transition-transform group-hover:scale-105 duration-200"
        >
          <defs>
            <linearGradient id="vidarch-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff113a" />
              <stop offset="100%" stopColor="#cc0029" />
            </linearGradient>
            <linearGradient id="vidarch-accent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>

          {/* Smooth Squircle Badge Container */}
          <rect
            x="2"
            y="2"
            width="28"
            height="28"
            rx="8"
            fill="url(#vidarch-bg)"
          />

          {/* Stylized Arch Cutout Line */}
          <path
            d="M8 8.5C8 7.67157 8.67157 7 9.5 7H22.5C23.3284 7 24 7.67157 24 8.5V9.5C24 10.3284 23.3284 11 22.5 11H9.5C8.67157 11 8 10.3284 8 9.5V8.5Z"
            fill="white"
            fillOpacity="0.25"
          />

          {/* Central Sharp Play / Video Archive Glyph */}
          <path
            d="M12.5 12.4C12.5 11.58 13.42 11.08 14.12 11.52L21.32 16.12C21.98 16.54 21.98 17.46 21.32 17.88L14.12 22.48C13.42 22.92 12.5 22.42 12.5 21.6V12.4Z"
            fill="url(#vidarch-accent)"
          />
        </svg>
      </div>

      {/* Brand Wordmark (Clean, Bold, sans badge) */}
      <div className="flex items-center">
        <span className={`font-black text-white ${textDimensions} font-sans leading-none flex items-center`}>
          Vid<span className="text-[#ff0033] ml-[1.5px]">Arch</span>
        </span>
      </div>
    </div>
  );
};
