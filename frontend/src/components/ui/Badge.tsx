import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'error' | 'info' | 'neutral' | 'accent' | 'default';
  size?: 'sm' | 'md' | 'lg' | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
  ...props
}) => {
  const variantStyles: Record<string, string> = {
    primary: 'bg-[#1e4d6b] text-white border-[#173e56]',
    success: 'bg-[#eef6f5] text-[#18655e] border-[#b7cfcb]',
    warning: 'bg-[#faf4ea] text-[#8a6b3a] border-[#e4dccf]',
    danger: 'bg-red-50 text-red-700 border-red-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-[#eef4f8] text-[#1e4d6b] border-[#c5d4de]',
    neutral: 'bg-[#f7f4ee] text-[#3d5363] border-[#e4dccf]',
    default: 'bg-[#f7f4ee] text-[#3d5363] border-[#e4dccf]',
    accent: 'bg-[#eef6f5] text-[#1f7a72] border-[#b7cfcb]',
  };

  const sizeStyles: Record<string, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${
        variantStyles[variant] || variantStyles.neutral
      } ${sizeStyles[size] || sizeStyles.sm} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
