import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface QuantitySelectorProps {
  value: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  value,
  onChange,
  min = 1,
  max,
  className,
}) => {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (max === undefined || value < max) onChange(value + 1);
  };

  return (
    <div className={twMerge('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        <Minus className="w-3.5 h-3.5 text-slate-600" />
      </button>
      <span className="w-10 text-center text-sm font-bold text-slate-800">{value}</span>
      <button
        type="button"
        onClick={increment}
        disabled={max !== undefined && value >= max}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
      >
        <Plus className="w-3.5 h-3.5 text-slate-600" />
      </button>
    </div>
  );
};
