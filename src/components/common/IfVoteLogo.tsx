import React from 'react';

interface IfVoteLogoProps {
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const IfVoteLogo: React.FC<IfVoteLogoProps> = ({
  theme = 'auto',
  className = '',
  size = 'md',
  showSubtitle = false,
}) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
    xl: 'h-24',
  };

  const currentTheme = theme === 'auto' ? 'dark' : theme;
  const basePath = (import.meta as any).env?.BASE_URL || './';
  const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const imageSrc = currentTheme === 'light' ? `${cleanBase}assets/logo-light.png` : `${cleanBase}assets/logo-dark.png`;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <img
        src={imageSrc}
        alt="IFVote — Urna Digital Estudantil"
        className={`${sizeClasses[size]} w-auto object-contain transition-transform`}
        loading="eager"
      />
      {showSubtitle && (
        <span className="text-[11px] font-medium tracking-wide text-slate-400 mt-1">
          Urna Digital Estudantil • Bragança, Pará
        </span>
      )}
    </div>
  );
};
