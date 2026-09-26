import React from 'react';

type BrandLogoProps = {
  className?: string;
};

/** Official BHARAT 3D mark (frontend/public/bharat3d-logo.png). */
export function BrandLogo({ className = 'h-10 w-10' }: BrandLogoProps) {
  return (
    <img
      src="/bharat3d-logo.png"
      alt="BHARAT 3D"
      className={`object-contain shrink-0 ${className}`}
      width={40}
      height={40}
    />
  );
}
