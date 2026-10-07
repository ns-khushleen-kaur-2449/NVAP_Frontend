import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plus, Search, Bed, Bath, Maximize, MapPin, IndianRupee } from 'lucide-react';
import { getProperties, createProperty } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadges';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newProp, setNewProp] = useState({
    name: '', developer: '', property_type: 'apartment', bedrooms: '', bathrooms: '',
    area_sqft: '', price: '', location: '', city: '', status: 'available',
    possession_date: '', amenities: '', description: '', image_url: ''
  });

  const fetchProperties = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter && typeFilter !== 'all') params.property_type = typeFilter;
      const r = await getProperties(params);
      setProperties(r.data.properties);
      setTotal(r.data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleCreate = async () => {
    try {
      const data = { ...newProp };
      if (data.bedrooms) data.bedrooms = parseInt(data.bedrooms);
      else delete data.bedrooms;
      if (data.bathrooms) data.bathrooms = parseInt(data.bathrooms);
      else delete data.bathrooms;
      if (data.area_sqft) data.area_sqft = parseFloat(data.area_sqft);
      else delete data.area_sqft;
      if (data.price) data.price = parseFloat(data.price);
      else delete data.price;
      if (data.amenities) data.amenities = data.amenities.split(',').map(a => a.trim());
      else data.amenities = [];
      await createProperty(data);
      toast.success('Property created');
      setShowCreate(false);
      setNewProp({ name: '', developer: '', property_type: 'apartment', bedrooms: '', bathrooms: '', area_sqft: '', price: '', location: '', city: '', status: 'available', possession_date: '', amenities: '', description: '', image_url: '' });
      fetchProperties();
    } catch (e) {
      toast.error('Failed to create property');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(var(--surface-2))] border-border"
            data-testid="properties-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] bg-[hsl(var(--surface-2))] border-border">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="villa">Villa</SelectItem>
            <SelectItem value="plot">Plot</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="ai-btn-glow bg-primary text-primary-foreground hover:bg-[hsl(173_80%_32%)]" data-testid="add-property-button">
              <Plus className="w-4 h-4 mr-1" /> Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg" data-testid="property-create-dialog">
            <DialogHeader>
              <DialogTitle className="font-display">Add Property</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Property Name *" value={newProp.name} onChange={e => setNewProp({...newProp, name: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border col-span-2" data-testid="property-name-input" />
              <Input placeholder="Developer" value={newProp.developer} onChange={e => setNewProp({...newProp, developer: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Select value={newProp.property_type} onValueChange={v => setNewProp({...newProp, property_type: v})}>
                <SelectTrigger className="bg-[hsl(var(--surface-2))] border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="villa">Villa</SelectItem>
                  <SelectItem value="plot">Plot</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Bedrooms" type="number" value={newProp.bedrooms} onChange={e => setNewProp({...newProp, bedrooms: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Input placeholder="Bathrooms" type="number" value={newProp.bathrooms} onChange={e => setNewProp({...newProp, bathrooms: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Input placeholder="Area (sqft)" type="number" value={newProp.area_sqft} onChange={e => setNewProp({...newProp, area_sqft: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Input placeholder="Price (INR)" type="number" value={newProp.price} onChange={e => setNewProp({...newProp, price: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Input placeholder="Location" value={newProp.location} onChange={e => setNewProp({...newProp, location: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Input placeholder="City" value={newProp.city} onChange={e => setNewProp({...newProp, city: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border" />
              <Input placeholder="Amenities (comma separated)" value={newProp.amenities} onChange={e => setNewProp({...newProp, amenities: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border col-span-2" />
              <Input placeholder="Image URL (optional)" value={newProp.image_url} onChange={e => setNewProp({...newProp, image_url: e.target.value})} className="bg-[hsl(var(--surface-2))] border-border col-span-2" />
            </div>
            <Button onClick={handleCreate} disabled={!newProp.name} className="mt-2 bg-primary text-primary-foreground" data-testid="create-property-submit">
              Add Property
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Property Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {properties.map(prop => (
          <Card key={prop.id} className="bg-card border-border overflow-hidden hover:border-[hsl(var(--surface-3))] transition-colors">
            {prop.image_url && (
              <div className="h-40 overflow-hidden bg-[hsl(var(--surface-2))]">
                <img src={prop.image_url} alt={prop.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold">{prop.name}</h3>
                  {prop.developer && <p className="text-xs text-muted-foreground">{prop.developer}</p>}
                </div>
                <StatusBadge status={prop.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                {prop.bedrooms && <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {prop.bedrooms} BHK</span>}
                {prop.bathrooms && <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {prop.bathrooms}</span>}
                {prop.area_sqft && <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> {prop.area_sqft} sqft</span>}
              </div>
              {prop.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                  <MapPin className="w-3 h-3" /> {prop.location}{prop.city ? `, ${prop.city}` : ''}
                </p>
              )}
              {prop.price && (
                <p className="font-display text-lg font-semibold text-primary flex items-center">
                  <IndianRupee className="w-4 h-4" /> {formatCurrency(prop.price)}
                </p>
              )}
              {prop.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {prop.amenities.slice(0, 4).map((a, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-0 bg-[hsl(var(--surface-2))]">{a}</Badge>
                  ))}
                  {prop.amenities.length > 4 && (
                    <Badge variant="outline" className="text-[10px] border-0 bg-[hsl(var(--surface-2))]">+{prop.amenities.length - 4}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {properties.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : 'No properties found'}</p>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">{total} properties total</p>
    </div>
  );
}
