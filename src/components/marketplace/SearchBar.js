import { Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SearchBar({ value, onChange, onSearch, placeholder = 'Search by location, city, or project name' }) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-[#DED7C7] bg-white p-4 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7A72]" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-lg border-[#DED7C7] bg-white pl-10 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          className="h-11 rounded-full bg-[#234A3C] px-6 text-white hover:bg-[#14251F]"
          type="button"
          onClick={onSearch}
        >
          <Sparkles className="mr-2 h-4 w-4" /> Search
        </Button>
      </div>
    </div>
  );
}
