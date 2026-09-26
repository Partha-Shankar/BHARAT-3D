import React from 'react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendPositive,
  className,
}) => {
  return (
    <div className={clsx('bg-white rounded-sm border border-[#e4dccf] p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#5c6e7c] uppercase tracking-wider">{title}</p>
        {icon && <div className="p-2 rounded-sm bg-[#eef6f5] text-[#1e4d6b]">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-bold text-[#16324a]">{value}</p>
        {trend && (
          <span
            className={clsx(
              'ml-2 text-xs font-semibold',
              trendPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-[#5c6e7c]">{subtitle}</p>}
    </div>
  );
};
