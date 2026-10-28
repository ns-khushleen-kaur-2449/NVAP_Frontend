import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, Loader2, Pencil, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  deleteBrochure, deleteProductBrochure, describeBrochure, downloadBrochure, uploadBrochure, uploadProductBrochure,
} from '@/lib/api';

// Brochure pieces shared by Settings' scheduling and products sections (moved from SchedulingSetup.jsx).

// Mirrors the backend's BROCHURE_MAX_BYTES default.
export const BROCHURE_MAX_MB = 10;
export const DESCRIPTION_MAX = 500;

export const errorList = (e, fallback) => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return [detail];
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      if (typeof d === 'string') return d;
      const field = (d.loc || []).filter((p) => p !== 'body').join('.');
      return field ? `${field}: ${d.msg}` : d.msg;
    });
  }
  return [fallback];
};

export const sizeLabel = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

/** The company default: flagged by the backend; rows from before products existed have no owner instead. */
export const isDefaultBrochure = (b) => (b.is_default ?? (!b.meeting_type_id && !b.product_id));

/**
 * One brochure slot: the company default (no ids), a meeting type's (meetingTypeId) or a product's (productId).
 * PDF only; the backend checks the file itself. ``onUpload`` replaces the upload call (the Catalog's Brochure column).
 */
export function BrochureControl({
  meetingTypeId = null, productId = null, brochure, fallbackNote, removeNote, canEdit, onChanged, onUpload, inputLabel = 'Brochure file',
}) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > BROCHURE_MAX_MB * 1024 * 1024) {
      toast.error(`The brochure must be at most ${BROCHURE_MAX_MB} MB`);
      return;
    }
    setBusy(true);
    try {
      if (onUpload) await onUpload(file); // e.g. a Catalog row, which creates its product first
      else if (productId) await uploadProductBrochure(productId, file);
      else await uploadBrochure(meetingTypeId, file);
      toast.success(brochure ? 'Brochure replaced' : 'Brochure uploaded');
      await onChanged();
    } catch (e) {
      toast.error(errorList(e, 'Failed to upload the brochure')[0]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    const after = removeNote || (meetingTypeId
      ? (fallbackNote ? 'This meeting type will use the company brochure.' : 'This meeting type will get no overview email.')
      : 'Meeting types without their own brochure will get no overview email.');
    if (!window.confirm(`Remove "${brochure.filename}"? ${after}`)) return;
    setBusy(true);
    try {
      if (productId) await deleteProductBrochure(productId);
      else await deleteBrochure(meetingTypeId);
      toast.success('Brochure removed');
      await onChanged();
    } catch (e) {
      toast.error(errorList(e, 'Failed to remove the brochure')[0]);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      const res = await downloadBrochure(brochure.id);
      const url = URL.createObjectURL(res.data);
      const link = Object.assign(document.createElement('a'), { href: url, download: brochure.filename });
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorList(e, 'Failed to download the brochure')[0]);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {brochure ? (
        <button type="button" onClick={download} className="font-medium hover:underline inline-flex items-center gap-1"
          title="Download">
          {brochure.filename} <span className="text-muted-foreground font-normal">({sizeLabel(brochure.size_bytes)})</span>
          <Download className="w-3 h-3 text-muted-foreground" />
        </button>
      ) : (
        <span className="text-muted-foreground">{fallbackNote || 'No brochure: overview emails are not sent'}</span>
      )}
      {canEdit && (
        <>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label={inputLabel}
            onChange={(e) => upload(e.target.files?.[0])} />
          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
            {brochure ? 'Replace' : 'Upload PDF'}
          </Button>
          {brochure && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" disabled={busy} onClick={remove}>
              <X className="w-3.5 h-3.5 mr-1" /> Remove
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** A brochure's short description, shown in the brochure email a lead asks for. */
export function DescriptionEditor({ brochure, canEdit, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!brochure) return null;
  const start = () => { setText(brochure.description || ''); setEditing(true); };
  const save = async () => {
    setBusy(true);
    try {
      await describeBrochure(brochure.id, text.trim() || null);
      toast.success('Description saved');
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast.error(errorList(e, 'Failed to save the description')[0]);
    } finally {
      setBusy(false);
    }
  };
  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input dir="auto" value={text} maxLength={DESCRIPTION_MAX} onChange={(e) => setText(e.target.value)} autoFocus
          aria-label={`Description of ${brochure.filename}`} placeholder="A sentence or two about what's inside"
          className="h-8 text-xs bg-[hsl(var(--surface-2))] border-border" />
        <Button size="sm" className="h-8" disabled={busy} onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    );
  }
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <span dir="auto">{brochure.description ? `About it: ${brochure.description}` : 'No description (the email just names the file).'}</span>
      {canEdit && (
        <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={start} aria-label={`Edit description of ${brochure.filename}`}>
          <Pencil className="w-3 h-3" />
        </Button>
      )}
    </p>
  );
}
