import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ChevronDown, ChevronUp, Loader2, UserPlus } from 'lucide-react';
import { createProspect } from '../../lib/api';
import { toast } from 'sonner';

// Dial codes, most-used first. `value` is the id Select needs; `dial` is what
// gets prefixed onto the number.
const COUNTRY_CODES = [
  { value: 'IN', dial: '+91', label: 'India', flag: '🇮🇳' },
  { value: 'AE', dial: '+971', label: 'UAE', flag: '🇦🇪' },
  { value: 'US', dial: '+1', label: 'USA / Canada', flag: '🇺🇸' },
  { value: 'GB', dial: '+44', label: 'UK', flag: '🇬🇧' },
  { value: 'SA', dial: '+966', label: 'Saudi Arabia', flag: '🇸🇦' },
  { value: 'SG', dial: '+65', label: 'Singapore', flag: '🇸🇬' },
  { value: 'AU', dial: '+61', label: 'Australia', flag: '🇦🇺' },
  { value: 'QA', dial: '+974', label: 'Qatar', flag: '🇶🇦' },
  { value: 'OM', dial: '+968', label: 'Oman', flag: '🇴🇲' },
  { value: 'KW', dial: '+965', label: 'Kuwait', flag: '🇰🇼' },
  { value: 'DE', dial: '+49', label: 'Germany', flag: '🇩🇪' },
  { value: 'FR', dial: '+33', label: 'France', flag: '🇫🇷' },
];

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual entry' },
  { value: 'website', label: 'Website' },
  { value: '99acres', label: '99acres' },
  { value: 'magicbricks', label: 'MagicBricks' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'Google Ads', label: 'Google Ads' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Cold Call', label: 'Cold Call' },
];

const EMPTY_FORM = {
  name: '',
  countryCode: 'IN',
  phone: '',
  email: '',
  city: '',
  project: '',
  budget_range: '',
  timeline: '',
  lead_source: 'manual',
  lead_owner: '',
};

export default function AddLeadDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear the error as soon as the user starts correcting it.
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const dialFor = (code) => COUNTRY_CODES.find(c => c.value === code)?.dial || '+91';

  const validate = () => {
    const next = {};

    if (!form.name.trim()) {
      next.name = 'Lead name is required';
    }

    // Keep digits only, so pasted numbers with spaces, dashes or brackets work.
    const digits = form.phone.replace(/\D/g, '');
    if (!digits) {
      next.phone = 'Contact number is required';
    } else if (digits.length < 6 || digits.length > 15) {
      next.phone = 'Enter a valid number (6-15 digits)';
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setShowOptional(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const digits = form.phone.replace(/\D/g, '');
      const payload = {
        full_name: form.name.trim(),
        // Stored E.164 so the dialler never has to guess the country.
        phone: `${dialFor(form.countryCode)}${digits}`,
        source: form.lead_source || 'manual',
        custom_fields: {},
      };
      const filled = (value) => value && value.trim();
      if (filled(form.email)) payload.email = form.email.trim();
      if (filled(form.lead_owner)) payload.lead_owner = form.lead_owner.trim();
      // Details with no prospect column go to custom_fields, only when filled.
      Object.entries({ city: form.city, project: form.project, budget_range: form.budget_range, timeline: form.timeline })
        .forEach(([key, value]) => { if (filled(value)) payload.custom_fields[key] = value.trim(); });

      await createProspect(payload);
      toast.success(`${payload.full_name} added`);
      reset();
      onOpenChange(false);
      if (onCreated) await onCreated();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not add the lead');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#F87217]" />
            Add Lead
          </DialogTitle>
          <DialogDescription>
            Name and contact number are required. Everything else can be filled in later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">
              Lead Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lead-name"
              placeholder="e.g. Aditi Attri"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              aria-invalid={Boolean(errors.name)}
              className={errors.name ? 'border-red-400 focus-visible:ring-red-200' : ''}
            />
            {errors.name && <p className="text-[11px] text-red-600">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">
              Contact Number <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Select value={form.countryCode} onValueChange={(v) => setField('countryCode', v)}>
                <SelectTrigger className="w-[120px] shrink-0" aria-label="Country code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="tabular-nums">{c.flag} {c.dial}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="lead-phone"
                inputMode="tel"
                placeholder="9876543210"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                aria-invalid={Boolean(errors.phone)}
                className={`flex-1 ${errors.phone ? 'border-red-400 focus-visible:ring-red-200' : ''}`}
              />
            </div>
            {errors.phone
              ? <p className="text-[11px] text-red-600">{errors.phone}</p>
              : <p className="text-[11px] text-muted-foreground">
                  Saved as {dialFor(form.countryCode)}{form.phone.replace(/\D/g, '') || '…'}
                </p>}
          </div>

          <button
            type="button"
            onClick={() => setShowOptional(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showOptional ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Optional details
          </button>

          {showOptional && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email" className="text-xs">Email</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    className={errors.email ? 'border-red-400 focus-visible:ring-red-200' : ''}
                  />
                  {errors.email && <p className="text-[11px] text-red-600">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-city" className="text-xs">City</Label>
                  <Input
                    id="lead-city"
                    placeholder="e.g. Dubai"
                    value={form.city}
                    onChange={(e) => setField('city', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-project" className="text-xs">Project</Label>
                  <Input
                    id="lead-project"
                    placeholder="Project of interest"
                    value={form.project}
                    onChange={(e) => setField('project', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-budget" className="text-xs">Budget Range</Label>
                  <Input
                    id="lead-budget"
                    placeholder="e.g. 1Cr - 2Cr"
                    value={form.budget_range}
                    onChange={(e) => setField('budget_range', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-timeline" className="text-xs">Timeline</Label>
                  <Input
                    id="lead-timeline"
                    placeholder="e.g. 3-6 months"
                    value={form.timeline}
                    onChange={(e) => setField('timeline', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-owner" className="text-xs">Lead Owner</Label>
                  <Input
                    id="lead-owner"
                    placeholder="Assigned rep"
                    value={form.lead_owner}
                    onChange={(e) => setField('lead_owner', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Source</Label>
                <Select value={form.lead_source} onValueChange={(v) => setField('lead_source', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#F87217] hover:bg-[#F87217]/90 text-white">
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Adding…</> : 'Add Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
