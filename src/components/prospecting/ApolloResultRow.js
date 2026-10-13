import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const present = (value) => value !== null && value !== undefined && String(value).trim() !== '';

// Apollo's free search only says whether a detail exists, never the detail itself.
function Availability({ value, label }) {
  if (value === true) return <Badge variant="secondary" className="text-[10px]">Has {label}</Badge>;
  if (value === false) return <Badge variant="outline" className="text-[10px] text-muted-foreground">No {label}</Badge>;
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">{label[0].toUpperCase() + label.slice(1)} not confirmed</Badge>;
}

/**
 * One masked person from POST /api/apollo/search. Shows exactly what the backend
 * returns: there is no full last name, email address, phone number or score.
 */
export default function ApolloResultRow({ person }) {
  const name = [person.first_name, person.last_name_masked].filter(present).join(' ') || 'Name not shown';

  return (
    <li className="border border-border rounded-lg p-3 bg-card space-y-2">
      <div className="min-w-0">
        <p className="text-sm font-medium break-words">{name}</p>
        {present(person.job_title) && <p className="text-xs text-muted-foreground break-words">{person.job_title}</p>}
      </div>
      {present(person.company_name) && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground min-w-0">
          <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{person.company_name}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Availability value={person.has_email} label="email" />
        <Availability value={person.has_phone} label="phone" />
        <Availability value={person.has_location} label="location" />
      </div>
    </li>
  );
}
