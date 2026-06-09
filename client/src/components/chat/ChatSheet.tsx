// Stub — replaced with the full implementation in Task 11.
// Exists so ChatButton's lazy import has a target during the T10 commit.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSheet({ open, onOpenChange }: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={() => onOpenChange(false)}
    >
      <div className="rounded-lg bg-white px-6 py-4 shadow-lg">
        Chat surface — full UI lands in Task 11.
      </div>
    </div>
  );
}
