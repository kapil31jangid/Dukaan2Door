import React from 'react';
import { Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label }) => {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 gap-3">
      <Loader2 className={twMerge('animate-spin text-emerald-600', sizeStyles[size], className)} />
      {label && <p className="text-xs font-medium text-slate-500 animate-pulse">{label}</p>}
    </div>
  );
};
