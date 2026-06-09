import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { useAgentChat } from "../../hooks/useAgentChat";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import { ThreadList } from "./ThreadList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSheet({ open, onOpenChange }: Props) {
  const chat = useAgentChat();
  const [showThreads, setShowThreads] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 flex flex-col bg-white shadow-2xl ring-1 ring-black/10
                     inset-x-0 bottom-0 top-12 rounded-t-2xl
                     md:inset-y-0 md:right-0 md:left-auto md:top-0 md:bottom-0
                     md:w-[480px] md:rounded-none md:rounded-l-2xl"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <button
              onClick={() => setShowThreads((s) => !s)}
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              {showThreads ? "Back to chat" : "Threads"}
            </button>
            <Dialog.Title className="text-sm font-semibold">Ask VOOM</Dialog.Title>
            <div className="flex gap-2">
              <button
                onClick={chat.newThread}
                aria-label="New thread"
                className="rounded p-1 text-slate-600 hover:bg-slate-100"
              >
                <Plus className="h-5 w-5" />
              </button>
              <Dialog.Close
                aria-label="Close"
                className="rounded p-1 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
          </header>

          {showThreads ? (
            <ThreadList
              onPick={(id) => {
                chat.loadThread(id);
                setShowThreads(false);
              }}
            />
          ) : (
            <>
              <MessageList messages={chat.messages} streaming={chat.streaming} error={chat.error} />
              <InputBar onSend={chat.send} disabled={chat.streaming} />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
