export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#282828] border-t-[#1DB954]" />
    </div>
  );
}
