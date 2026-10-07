import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProperty } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bed, Bath, Maximize, Calendar, Mail } from 'lucide-react';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';

const fallbackImages = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='650'><defs><linearGradient id='g1' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23dbeafe'/><stop offset='100%' stop-color='%23fef3c7'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g1)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='650'><defs><linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23e0f2fe'/><stop offset='100%' stop-color='%23dcfce7'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g2)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='650'><defs><linearGradient id='g3' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23fde68a'/><stop offset='100%' stop-color='%23fce7f3'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g3)'/></svg>",
];

export default function MarketplaceDetailsPage() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setLoading(true);
    getProperty(id)
      .then((res) => setProperty(res.data))
      .catch(() => setProperty(null))
      .finally(() => setLoading(false));
  }, [id]);

  const images = useMemo(() => {
    if (property?.image_url) return [property.image_url, ...fallbackImages.slice(0, 2)];
    return fallbackImages;
  }, [property]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <MarketingNav />
        <div className="px-4 py-16">
          <div className="mx-auto max-w-6xl rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">
            Loading property details...
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <MarketingNav />
        <div className="px-4 py-16">
          <div className="mx-auto max-w-6xl rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">
            Property not found.
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <MarketingNav />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/marketplace/listings" className="text-xs text-muted-foreground">&larr; Back to listings</Link>
            <h1 className="font-display text-3xl font-semibold">{property.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {property.location} {property.city ? `, ${property.city}` : ''}
            </div>
          </div>
          <Badge className="bg-[hsla(215,84%,47%,0.12)] text-[hsl(var(--primary))]">Verified Listing</Badge>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border">
              <img
                src={images[activeImage]}
                alt={property.name}
                className="h-[420px] w-full object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, index) => (
                <button
                  key={img}
                  onClick={() => setActiveImage(index)}
                  className={`overflow-hidden rounded-xl border ${activeImage === index ? 'border-[hsl(var(--primary))]' : 'border-border'}`}
                >
                  <img src={img} alt="Property thumbnail" className="h-24 w-full object-cover" />
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="text-lg font-semibold">Overview</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {property.description || 'A premium property experience with curated amenities and modern design.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {property.bedrooms && (
                  <span className="flex items-center gap-2"><Bed className="h-4 w-4" /> {property.bedrooms} Bedrooms</span>
                )}
                {property.bathrooms && (
                  <span className="flex items-center gap-2"><Bath className="h-4 w-4" /> {property.bathrooms} Bathrooms</span>
                )}
                {property.area_sqft && (
                  <span className="flex items-center gap-2"><Maximize className="h-4 w-4" /> {property.area_sqft} sqft</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="text-lg font-semibold">Amenities</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(property.amenities || ['Concierge', 'Gym', 'Pool', 'Parking']).map((amenity) => (
                  <Badge key={amenity} variant="secondary" className="bg-[hsl(var(--surface-2))]">
                    {amenity}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="text-lg font-semibold">Location & Access</h2>
              <div className="mt-4 rounded-xl border border-dashed border-border bg-[hsl(var(--surface-2))] p-6 text-sm text-muted-foreground">
                Interactive map placeholder. Integrate your map provider here.
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl border border-border bg-white p-6">
                <p className="text-xs text-muted-foreground">Starting price</p>
                <p className="mt-2 text-2xl font-semibold text-[hsl(var(--primary))]">
                  {property.price ? formatCurrency(property.price) : 'On Request'}
                </p>
                <div className="mt-4 space-y-3">
                  <Button className="w-full bg-[hsl(var(--primary))] text-primary-foreground">Schedule a Visit</Button>
                  <Button variant="outline" className="w-full border-border">Request Brochure</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6">
                <h3 className="text-sm font-semibold">Agent</h3>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsla(215,84%,47%,0.12)] text-[hsl(var(--primary))]">A</div>
                  <div>
                    <p className="text-sm font-medium">Ariana Kapoor</p>
                    <p className="text-xs text-muted-foreground">Senior Advisor</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Button variant="outline" className="w-full border-border">
                    <Mail className="mr-2 h-4 w-4" /> Send Inquiry
                  </Button>
                  <Button variant="outline" className="w-full border-border">
                    <Calendar className="mr-2 h-4 w-4" /> Book Call
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6">
                <h3 className="text-sm font-semibold">Similar Properties</h3>
                <p className="mt-2 text-xs text-muted-foreground">We will suggest comparable listings soon.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
