import { lazy, Suspense, useState } from "react";
import { MessageCircle } from "lucide-react";

const ChatSheet = lazy(() => import("./ChatSheet").then((m) => ({ default: m.ChatSheet })));

const HIDDEN_ROUTES = ["/vendor/register"];

export function ChatButton() {
  const [open, setOpen] = useState(false);

  if (HIDDEN_ROUTES.some((r) => window.location.pathname.startsWith(r))) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the dashboard"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-1 ring-black/10 hover:bg-blue-700 active:scale-95 transition md:bottom-6 md:right-6"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      {open && (
        <Suspense fallback={null}>
          <ChatSheet open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
