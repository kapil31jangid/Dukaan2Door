import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  onSearch?: (q: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  defaultValue = '',
  placeholder = 'Search products…',
  className,
  onSearch,
}) => {
  const navigate = useNavigate();
  const [value, setValue] = React.useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (onSearch) {
      onSearch(q);
    } else {
      navigate(`/customer/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={twMerge('relative flex-1', className)}>
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-rose-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
      />
    </form>
  );
};
