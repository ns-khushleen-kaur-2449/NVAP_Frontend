import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft, ArrowRight, MapPin, Bed, Bath, Maximize, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

const placeholderImages = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=80',
];

export default function PropertyCard({ property, onSave, onCompare, onContact, featured, href }) {
  const images = useMemo(() => {
    if (property?.image_url) return [property.image_url, ...placeholderImages.slice(0, 2)];
    return placeholderImages;
  }, [property]);
  const [index, setIndex] = useState(0);

  return (
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-sm bg-white ring-1 ring-[#DED7C7] transition-shadow duration-300 hover:shadow-[0_30px_60px_-40px_rgba(20,37,31,0.4)]',
        featured && 'ring-[#234A3C]'
      )}
    >
      <div className="relative h-56 overflow-hidden">
        {href ? (
          <Link to={href} className="block h-full w-full">
            <img
              src={images[index]}
              alt={property?.name || 'Residence'}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              loading="lazy"
            />
          </Link>
        ) : (
          <img
            src={images[index]}
            alt={property?.name || 'Residence'}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#14251F]">
            Verified
          </span>
          {property?.status && (
            <span className="rounded-full bg-[#234A3C]/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white">
              {property.status.replace('_', ' ')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSave?.(property)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#14251F] transition-colors hover:bg-white hover:text-[#B4894E]"
          aria-label="Save residence"
        >
          <Heart className="h-4 w-4" />
        </button>
        {images.length > 1 && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setIndex((p) => (p - 1 + images.length) % images.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#14251F] hover:bg-white"
              aria-label="Previous photo"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((p) => (p + 1) % images.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#14251F] hover:bg-white"
              aria-label="Next photo"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          {href ? (
            <Link
              to={href}
              className="font-[Fraunces,serif] text-[1.5rem] font-light leading-tight text-[#14251F] transition-colors hover:text-[#234A3C]"
            >
              {property?.name || 'Premium Residence'}
            </Link>
          ) : (
            <h3 className="font-[Fraunces,serif] text-[1.5rem] font-light leading-tight text-[#14251F]">
              {property?.name || 'Premium Residence'}
            </h3>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#6B7A72]">
            <MapPin className="h-3.5 w-3.5" />
            <span>{property?.location || 'Jaipur'}{property?.city ? `, ${property.city}` : ''}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7A72]">
          {property?.bedrooms && (
            <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {property.bedrooms} Beds</span>
          )}
          {property?.bathrooms && (
            <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {property.bathrooms} Baths</span>
          )}
          {property?.area_sqft && (
            <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {property.area_sqft} sqft</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(property?.amenities || []).slice(0, 3).map((amenity, i) => (
            <span key={`${amenity}-${i}`} className="rounded-full bg-[#F0ECE2] px-2.5 py-1 text-[0.7rem] text-[#3C4B43]">
              {amenity}
            </span>
          ))}
          {(property?.amenities || []).length > 3 && (
            <span className="rounded-full bg-[#F0ECE2] px-2.5 py-1 text-[0.7rem] text-[#3C4B43]">
              +{property.amenities.length - 3}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-[#EBE6DA] pt-4">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.14em] text-[#6B7A72]">Starting at</p>
            <p className="font-[Fraunces,serif] text-xl text-[#234A3C]">
              {property?.price ? formatCurrency(property.price) : 'On request'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-[#DED7C7] text-[#14251F] hover:border-[#234A3C]"
              onClick={() => onCompare?.(property)}
            >
              Compare
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-[#234A3C] text-white hover:bg-[#14251F]"
              onClick={() => onContact?.(property)}
            >
              Enquire <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
