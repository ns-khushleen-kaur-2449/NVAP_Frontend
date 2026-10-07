export default function PropertyGrid({ children }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}
