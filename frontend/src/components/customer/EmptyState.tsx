import React from 'react';
import { twMerge } from 'tailwind-merge';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => {
  return (
    <div className={twMerge('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-xs">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
