"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let listeners: Listener[] = [];
let counter = 0;

function emit() {
  for (const l of listeners) l([...items]);
}

export function toast(opts: { title: string; description?: string; variant?: ToastVariant }) {
  const id = ++counter;
  items = [...items, { id, variant: opts.variant ?? "info", ...opts }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 4500);
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

export function Toaster() {
  const [list, setList] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const listener: Listener = (next) => setList(next);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 no-print">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-background p-4 shadow-lg animate-fade-in"
          )}
        >
          {icons[t.variant]}
          <div className="flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
          </div>
          <button
            onClick={() => {
              items = items.filter((x) => x.id !== t.id);
              emit();
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
