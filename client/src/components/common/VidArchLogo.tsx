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
    {/* Vault / arch — the archive */}
    <path
      d="M7.25 25.75V14.1C7.25 9.15 11.05 5.6 16 5.6C20.95 5.6 24.75 9.15 24.75 14.1V25.75"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.25 25.75H24.75"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    {/* Stored reels / shelves */}
    <rect x="11.15" y="12.15" width="9.7" height="2.05" rx="0.75" fill="currentColor" />
    <rect x="11.15" y="16.1" width="9.7" height="2.05" rx="0.75" fill="#ff0033" />
    <rect x="11.15" y="20.05" width="9.7" height="2.05" rx="0.75" fill="currentColor" />
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
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <VidArchMark className={`${iconDimensions} flex-shrink-0 text-white`} />
      {wordmark && (
        <span
          className={`font-semibold text-white ${textDimensions} tracking-[-0.035em] leading-none`}
        >
          VidArch
        </span>
      )}
    </div>
  );
};
