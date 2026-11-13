import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';

const move = (list, from, to) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * A numbered list reordered by dragging (native drag and drop) or with the up and down buttons, which also work
 * from the keyboard. items: [{ key, label }]; `action` renders an extra button per item.
 */
export default function ReorderList({ label, items, onChange, editable = true, action, empty }) {
  const [dragging, setDragging] = useState(null);
  if (!items.length) return <p className="text-xs text-muted-foreground px-1 py-2">{empty}</p>;
  return (
    <ol aria-label={label} className="space-y-1">
      {items.map((item, index) => (
        <li key={item.key} draggable={editable}
          onDragStart={() => setDragging(index)}
          onDragOver={(e) => { if (editable && dragging !== null) e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== index) onChange(move(items, dragging, index));
            setDragging(null);
          }}
          onDragEnd={() => setDragging(null)}
          className={`flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm ${dragging === index ? 'opacity-50' : ''}`}>
          {editable && <GripVertical className="w-4 h-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />}
          <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
          <span className="flex-1 truncate" dir="auto">{item.label}</span>
          {editable && (
            <>
              <button type="button" aria-label={`Move ${item.label} up in ${label}`} disabled={index === 0}
                onClick={() => onChange(move(items, index, index - 1))} className="disabled:opacity-30">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" aria-label={`Move ${item.label} down in ${label}`} disabled={index === items.length - 1}
                onClick={() => onChange(move(items, index, index + 1))} className="disabled:opacity-30">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              {action?.(item)}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
