import { Download } from 'lucide-react';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ErrorState } from '@/components/ops/States';
import { INVOICE_STATUS, formatDate, formatMoney } from './billingUi';

export default function InvoiceTable({ invoices, error, onRetry }) {
  if (error) return <ErrorState title="Billing history could not be loaded." message={error} onRetry={onRetry} />;
  if (!invoices.length) return <EmptyState title="No invoices yet." body="Invoices appear here after your first payment." />;
  return (
    <div className="ops-card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-semibold">Invoice</th>
            <th scope="col" className="px-4 py-3 font-semibold">Date</th>
            <th scope="col" className="px-4 py-3 font-semibold">Amount</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Download</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const status = INVOICE_STATUS[invoice.status] || { label: invoice.status, tone: 'neutral' };
            const link = invoice.invoice_pdf || invoice.hosted_invoice_url;
            return (
              <tr key={invoice.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{invoice.number || invoice.id}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(invoice.created)}</td>
                <td className="ops-num px-4 py-3">{formatMoney(invoice.amount, invoice.currency)}</td>
                <td className="px-4 py-3"><StatusBadge label={status.label} tone={status.tone} /></td>
                <td className="px-4 py-3 text-right">
                  {link
                    ? <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Download invoice ${invoice.number || invoice.id}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--ops-accent-ink)] hover:underline"><Download className="h-4 w-4" aria-hidden="true" /> Download</a>
                    : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
