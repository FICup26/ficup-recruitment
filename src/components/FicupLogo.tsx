import { useState } from 'react';

export const FICUP_OFFICIAL_LOGO_URL = 'https://i.ibb.co/qMkJ3RF2/image-de89ce2f.jpg';

interface FicupLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<FicupLogoProps['size']>, string> = {
  xs: 'h-8 w-auto max-w-[44px]',
  sm: 'h-10 w-auto max-w-[56px]',
  md: 'h-12 w-auto max-w-[72px]',
  lg: 'h-16 w-auto max-w-[96px]',
  hero: 'h-20 sm:h-24 w-auto max-w-[136px]',
};

export function FicupLogo({ size = 'sm', className = '' }: FicupLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl bg-[#0B1F4D] border border-[#C69214]/40 px-2.5 py-1 font-display font-extrabold tracking-tight text-white text-xs ${className}`}
      >
        FANTA ITALIA CUP
      </span>
    );
  }

  return (
    <img
      src={FICUP_OFFICIAL_LOGO_URL}
      alt="Logo ufficiale FANTA ITALIA CUP"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${SIZE_CLASSES[size]} object-contain select-none rounded-lg ${className}`}
    />
  );
}
