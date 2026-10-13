import { Building2, Mail, MapPin, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const present = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const joined = (parts) => parts.filter(present).join(' · ');

function Detail({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground min-w-0">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/**
 * One prospect from POST /api/ai/filter/search. Shows only what the response
 * holds; anything missing is left out rather than guessed.
 */
export default function ProspectResultRow({ prospect }) {
  const company = prospect.company || {};
  const name = present(prospect.full_name)
    ? prospect.full_name
    : [prospect.first_name, prospect.last_name].filter(present).join(' ') || 'Unnamed prospect';
  const role = joined([prospect.job_title, prospect.seniority]);
  const companyLine = joined([company.name, company.industry]);
  const location = [prospect.city, prospect.state, prospect.country].filter(present).join(', ');
  const hasScore = typeof prospect.score === 'number';

  return (
    <li className="border border-border rounded-lg p-3 bg-card space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{name}</p>
          {role && <p className="text-xs text-muted-foreground break-words">{role}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
          <p className="text-sm font-semibold" aria-label={hasScore ? `Score ${prospect.score}` : 'No score yet'}>
            {hasScore ? prospect.score : '—'}
          </p>
        </div>
      </div>

      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {companyLine && <Detail icon={Building2}>{companyLine}</Detail>}
        {location && <Detail icon={MapPin}>{location}</Detail>}
        {present(prospect.email) && (
          <Detail icon={Mail}>
            {prospect.email}
            {prospect.has_verified_email && <Badge variant="secondary" className="ml-1.5 text-[10px]">Verified</Badge>}
          </Detail>
        )}
        <Detail icon={Phone}>
          {present(prospect.phone) ? prospect.phone : prospect.has_phone ? 'Phone on file' : 'No phone'}
        </Detail>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {prospect.is_decision_maker && <Badge variant="secondary" className="text-[10px]">Decision maker</Badge>}
        {present(prospect.department) && <Badge variant="outline" className="text-[10px]">{prospect.department}</Badge>}
        {present(prospect.status) && <Badge variant="outline" className="text-[10px]">Status: {prospect.status}</Badge>}
        {present(prospect.source) && <Badge variant="outline" className="text-[10px]">Source: {prospect.source}</Badge>}
        {/* The backend sends a tenant only to a Super Admin. */}
        {present(prospect.tenant?.name) && <Badge variant="outline" className="text-[10px]">Tenant: {prospect.tenant.name}</Badge>}
      </div>
    </li>
  );
}
