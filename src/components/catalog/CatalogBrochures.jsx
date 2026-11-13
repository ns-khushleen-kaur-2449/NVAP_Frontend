import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { listBrochures, listExecutiveCandidates } from '@/lib/api';
import BrochureProducts from '@/components/admin/BrochureProducts';
import { BrochureControl, DescriptionEditor, errorList, isDefaultBrochure } from '@/components/admin/brochureControls';

// The Catalog page's brochures (moved from Settings → Meeting scheduling). They keep the /api/v1/scheduling
// rules: Tenant Admins upload, Managers view. Meeting-type brochures stay with the meeting types in Settings.
// A product's brochure is uploaded in the table's Brochure column (Catalog.jsx).

/** The company brochure, at the top of the page. */
export function CompanyBrochure({ canEdit }) {
  const [brochure, setBrochure] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const res = await listBrochures();
      setBrochure((res?.data || []).find(isDefaultBrochure) || null);
    } catch (e) {
      toast.error(errorList(e, 'Failed to load the company brochure')[0]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Card className="card-base p-4 space-y-1.5" aria-labelledby="company-brochure">
      <h2 id="company-brochure" className="text-sm font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" /> Company brochure
      </h2>
      <p className="text-xs text-muted-foreground">
        Sent when a lead asks for a brochure of a product without its own (Brochure column below), and attached to the
        overview email after a booking unless the meeting type has its own (Settings → Meeting scheduling).
        {canEdit ? '' : ' Only a Tenant Admin can change it.'}
      </p>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <>
          <BrochureControl meetingTypeId={null} brochure={brochure} canEdit={canEdit} onChanged={load}
            inputLabel="Company brochure file" fallbackNote="No company brochure yet" />
          <DescriptionEditor brochure={brochure} canEdit={canEdit} onChanged={load} />
        </>
      )}
    </Card>
  );
}

/** Below the table: every brochure product with its aliases (other ways leads say it), and the sender. */
export default function CatalogBrochures({ canEdit }) {
  const [candidates, setCandidates] = useState([]);
  useEffect(() => {
    listExecutiveCandidates().then((res) => setCandidates(res?.data || []))
      .catch((e) => toast.error(errorList(e, 'Failed to load the brochure senders')[0]));
  }, []);
  return (
    <Card className="card-base p-5 space-y-2" aria-labelledby="catalog-brochures">
      <h2 id="catalog-brochures" className="text-sm font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" /> Brochures
      </h2>
      <p className="text-xs text-muted-foreground">
        A product gets a brochure entry when you upload one in the table. Add aliases here so the agent recognises
        other ways leads say it, and choose whose mailbox sends them.
      </p>
      <BrochureProducts canEdit={canEdit} candidates={candidates} />
    </Card>
  );
}
