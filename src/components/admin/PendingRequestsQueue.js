import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadges';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, RotateCw } from 'lucide-react';

export default function PendingRequestsQueue({ pendingLeads = [], manualFollowups = [] }) {
  const combined = [
    ...pendingLeads.map(l => ({ ...l, issue_type: 'retry_pending' })),
    ...manualFollowups.map(l => ({ ...l, issue_type: 'manual_followup_required' }))
  ].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return (
    <Card className="card-base flex flex-col h-full">
      <CardHeader className="pb-3 border-b border-border/50 bg-[hsl(var(--surface-3))]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" /> Action Required Queue
          </CardTitle>
          <div className="flex gap-2 text-xs font-medium">
            <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{pendingLeads.length} Pending</span>
            <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{manualFollowups.length} Manual</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-auto flex-1 max-h-[400px]">
        {combined.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <RotateCw className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-sm font-medium">Queue is empty</p>
            <p className="text-xs">All automated tasks and follow-ups are up to date.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-[hsl(var(--surface-3))] z-10">
              <TableRow>
                <TableHead className="text-xs font-semibold">Lead</TableHead>
                <TableHead className="text-xs font-semibold">Issue Type</TableHead>
                <TableHead className="text-xs font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combined.map((item, idx) => (
                <TableRow key={item.id || idx} className="table-row-hover">
                  <TableCell>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.phone}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.issue_type} />
                    {item.retry_count > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Attempt {item.retry_count}/3
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="h-7 text-xs bg-white shadow-sm">
                      Resolve
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
