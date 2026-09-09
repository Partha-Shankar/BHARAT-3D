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
    primary: 'bg-navy-900 text-white border-navy-800',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    accent: 'bg-orange-50 text-orange-700 border-orange-200',
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
