import React from 'react';

interface VidArchLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  wordmark?: boolean;
}

export const VidArchMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    {/* A video stored in a compact archive box. */}
    <path
      d="M6.2 6.5h19.6A2.2 2.2 0 0 1 28 8.7v2.8H4V8.7a2.2 2.2 0 0 1 2.2-2.2Z"
      fill="currentColor"
    />
    <path
      d="M6 13h20v10.3a2.2 2.2 0 0 1-2.2 2.2H8.2A2.2 2.2 0 0 1 6 23.3V13Z"
      fill="currentColor"
    />
    <path d="m14 16 5.5 3.25L14 22.5V16Z" fill="white" />
  </svg>
);

export const VidArchLogo: React.FC<VidArchLogoProps> = ({
  size = 'md',
  className = '',
  wordmark = true,
}) => {
  const iconDimensions = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  }[size];

  const textDimensions = {
    sm: 'text-[15px]',
    md: 'text-lg',
    lg: 'text-[1.65rem]',
  }[size];

  return (
    <div className={`flex items-center gap-1.5 select-none ${className}`}>
      <VidArchMark className={`va-logo-mark ${iconDimensions} flex-shrink-0`} />
      {wordmark && (
        <span
          className={`va-wordmark font-semibold text-white ${textDimensions} tracking-[-0.035em] leading-none`}
        >
          <span>Vid</span><span className="text-[#ff7180]">Arch</span>
        </span>
      )}
    </div>
  );
};
