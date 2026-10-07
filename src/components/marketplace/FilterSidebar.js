import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

const amenityOptions = ['Gym', 'Pool', 'Concierge', 'EV Charging', 'Smart Home', 'Garden', 'Clubhouse'];

export default function FilterSidebar({ filters, setFilters, onClear }) {
  return (
    <aside className="space-y-6 rounded-2xl border border-border bg-white p-5 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.3)]">
      <div>
        <p className="text-sm font-semibold">Filters</p>
        <p className="text-xs text-muted-foreground">Refine for the perfect match.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Location</label>
          <Input
            value={filters.location}
            onChange={(event) => setFilters({ ...filters, location: event.target.value })}
            placeholder="Neighborhood or city"
            className="mt-2 h-10 rounded-lg border-border"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Property Type</label>
          <Select
            value={filters.type}
            onValueChange={(value) => setFilters({ ...filters, type: value })}
          >
            <SelectTrigger className="mt-2 h-10 rounded-lg border-border">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="apartment">Apartment</SelectItem>
              <SelectItem value="villa">Villa</SelectItem>
              <SelectItem value="plot">Plot</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Budget Range</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              value={filters.minPrice}
              onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })}
              placeholder="Min"
              className="h-10 rounded-lg border-border"
            />
            <Input
              value={filters.maxPrice}
              onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })}
              placeholder="Max"
              className="h-10 rounded-lg border-border"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Bedrooms</label>
          <Select
            value={filters.bedrooms}
            onValueChange={(value) => setFilters({ ...filters, bedrooms: value })}
          >
            <SelectTrigger className="mt-2 h-10 rounded-lg border-border">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Amenities</label>
          <div className="mt-2 space-y-2">
            {amenityOptions.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={filters.amenities.includes(amenity)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...filters.amenities, amenity]
                      : filters.amenities.filter((item) => item !== amenity);
                    setFilters({ ...filters, amenities: next });
                  }}
                />
                {amenity}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 border-border"
          onClick={onClear}
        >
          Clear
        </Button>
        <Button className="flex-1 rounded-full bg-[#234A3C] text-white hover:bg-[#14251F]">Apply</Button>
      </div>
    </aside>
  );
}
