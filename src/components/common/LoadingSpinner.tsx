export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
    </div>
  );
}
