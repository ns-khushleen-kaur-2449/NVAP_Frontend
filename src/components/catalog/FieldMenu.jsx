import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** A field's ⋯ menu on its column header (editors only): matching on or off, its settings, rename, remove. */
export default function FieldMenu({ column, onToggleMatching, onSettings, onRename, onRemove }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Field actions for ${column.label}`} title="Field actions"
          className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted">
          <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuCheckboxItem checked={Boolean(column.matchable)} onSelect={() => onToggleMatching(column)}>
          Agent can filter by this
        </DropdownMenuCheckboxItem>
        {onSettings && <DropdownMenuItem onSelect={() => onSettings(column)}>Field settings</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => onRename(column)}>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => onRemove(column)}>Remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
