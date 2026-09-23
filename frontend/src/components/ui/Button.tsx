import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm disabled:bg-emerald-300',
    secondary: 'bg-slate-800 text-white hover:bg-slate-900 active:bg-slate-950 shadow-sm disabled:bg-slate-400',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm disabled:bg-rose-300',
    success: 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm disabled:bg-teal-300',
    ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-300',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
    md: 'px-4 py-2 text-sm font-semibold rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-base font-semibold rounded-xl gap-2.5',
  };

  return (
    <button
      className={twMerge(
        'inline-flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
