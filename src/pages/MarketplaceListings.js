import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProperties } from '@/lib/api';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import SearchBar from '@/components/marketplace/SearchBar';
import FilterSidebar from '@/components/marketplace/FilterSidebar';
import PropertyGrid from '@/components/marketplace/PropertyGrid';
import PropertyCard from '@/components/marketplace/PropertyCard';
import PropertySkeleton from '@/components/marketplace/PropertySkeleton';
import EmptyState from '@/components/marketplace/EmptyState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZE = 9;

export default function MarketplaceListingsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState('recommended');
  const [filters, setFilters] = useState({
    location: '',
    type: 'all',
    minPrice: '',
    maxPrice: '',
    bedrooms: 'any',
    amenities: [],
  });

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filters.type && filters.type !== 'all') params.property_type = filters.type;
      const res = await getProperties(params);
      setProperties(res.data.properties || []);
    } catch {
      setProperties([]);
    }
    setLoading(false);
  }, [search, filters.type]);

  useEffect(() => {
    const initialSearch = searchParams.get('search') || '';
    if (initialSearch) setSearch(initialSearch);
  }, [searchParams]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filters, sort]);

  const filtered = useMemo(() => {
    return properties.filter((property) => {
      if (filters.location) {
        const target = `${property.location || ''} ${property.city || ''}`.toLowerCase();
        if (!target.includes(filters.location.toLowerCase())) return false;
      }
      if (filters.minPrice && property.price && Number(property.price) < Number(filters.minPrice)) return false;
      if (filters.maxPrice && property.price && Number(property.price) > Number(filters.maxPrice)) return false;
      if (filters.bedrooms !== 'any' && property.bedrooms && Number(property.bedrooms) < Number(filters.bedrooms)) return false;
      if (filters.amenities.length > 0) {
        const amenities = property.amenities || [];
        if (!filters.amenities.every((item) => amenities.includes(item))) return false;
      }
      return true;
    });
  }, [properties, filters]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === 'price-high') list.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sort === 'price-low') list.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === 'bedrooms') list.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0));
    return list;
  }, [filtered, sort]);

  const visible = sorted.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <MarketingNav />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#B4894E]">The Residences</p>
            <h1 className="mt-2 font-[Fraunces,serif] text-4xl font-light text-[#14251F]">Homes ready to view across Jaipur</h1>
          </div>
          <Button asChild variant="outline" className="rounded-full border-[#DED7C7] text-[#14251F] hover:border-[#234A3C]">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>

        <div className="mt-6">
          <SearchBar value={search} onChange={setSearch} onSearch={fetchProperties} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <FilterSidebar
            filters={filters}
            setFilters={setFilters}
            onClear={() => setFilters({ location: '', type: 'all', minPrice: '', maxPrice: '', bedrooms: 'any', amenities: [] })}
          />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{sorted.length} properties found</p>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[180px] border-border bg-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="bedrooms">Bedrooms</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <PropertyGrid>
                {Array.from({ length: 6 }).map((_, index) => (
                  <PropertySkeleton key={index} />
                ))}
              </PropertyGrid>
            ) : sorted.length === 0 ? (
              <EmptyState
                title="No properties matched your search"
                description="Try expanding your filters or explore curated recommendations."
              />
            ) : (
              <PropertyGrid>
                {visible.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    href={`/marketplace/listings/${property.id}`}
                  />
                ))}
              </PropertyGrid>
            )}

            {!loading && visibleCount < sorted.length && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="border-border"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
