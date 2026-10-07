import { Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PROJECTS = [
  {
    name: 'Shubh Nilay',
    type: 'Residential',
    location: 'Netsmartz Realty',
    units: '—',
    status: 'Active',
  },
  {
    name: 'Sansaar',
    type: 'Residential',
    location: 'Netsmartz Realty',
    units: '—',
    status: 'Active',
  },
  {
    name: 'Spring Villa',
    type: 'Villa',
    location: 'Netsmartz Realty',
    units: '—',
    status: 'Active',
  },
  {
    name: 'Mangus',
    type: 'Residential',
    location: 'Netsmartz Realty',
    units: '—',
    status: 'Active',
  },
];

const statusStyle = {
  Active:    'bg-emerald-500/15 text-emerald-600',
  Upcoming:  'bg-blue-500/15 text-blue-600',
  Completed: 'bg-muted text-muted-foreground',
};

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">Netsmartz Realty property projects.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" /> All Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Project Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Group</th>
                  <th className="px-4 py-3 text-left">Units</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p) => (
                  <tr
                    key={p.name}
                    className="border-b border-border hover:bg-[hsl(var(--surface-2))] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.location}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.units}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[p.status] || 'bg-muted text-muted-foreground'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
