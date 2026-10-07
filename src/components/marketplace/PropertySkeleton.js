export default function PropertySkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white">
      <div className="h-52 animate-pulse bg-[hsl(var(--surface-3))]" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[hsl(var(--surface-3))]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[hsl(var(--surface-3))]" />
        <div className="flex gap-3">
          <div className="h-3 w-16 animate-pulse rounded bg-[hsl(var(--surface-3))]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[hsl(var(--surface-3))]" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-full bg-[hsl(var(--surface-3))]" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-[hsl(var(--surface-3))]" />
        </div>
        <div className="mt-auto h-8 w-1/2 animate-pulse rounded bg-[hsl(var(--surface-3))]" />
      </div>
    </div>
  );
}
