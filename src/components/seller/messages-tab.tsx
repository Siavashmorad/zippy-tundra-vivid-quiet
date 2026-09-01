import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import {
  listSellerMessages,
  listSellerThreads,
  readSellerThread,
  searchSellerMessages,
  sendSellerChat,
} from "@/lib/toranj/api/messages";
import { toFaError } from "@/lib/toranj/errors";
import { customerFullName, formatTime, relativeTime } from "@/lib/toranj/format";
import { displayPhone } from "@/lib/toranj/phone";
import { toast } from "sonner";
import { EmptyState, inputClass } from "./ui";

export function MessagesTab({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (id?: string) => void;
}) {
  const [q, setQ] = useState("");
  const threads = useQuery({
    queryKey: ["threads", q],
    queryFn: () => listSellerThreads({ data: { q } }),
  });
  const search = useQuery({
    queryKey: ["msg-search", q],
    queryFn: () => searchSellerMessages({ data: { q } }),
    enabled: q.trim().length > 1,
  });

  if (selectedId) {
    return <Chat customerId={selectedId} onBack={() => onSelect(undefined)} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3">
        <input
          className={inputClass}
          placeholder="جستجوی گفتگو یا متن پیام"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {search.data && q.trim().length > 1 ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-ink-faint">نتایج پیام</p>
            {search.data.length === 0 ? (
              <p className="text-sm text-ink-soft">پیامی پیدا نشد.</p>
            ) : (
              <ul className="space-y-2">
                {search.data.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-surface px-3 py-2 text-right text-sm shadow-card"
                      onClick={() => m.customerId && onSelect(m.customerId)}
                    >
                      <p className="line-clamp-2">{m.body}</p>
                      <p className="mt-1 text-xs text-ink-faint">{relativeTime(m.createdAt)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {threads.isError ? (
          <EmptyState title="خطا در دریافت پیام‌ها" hint={toFaError(threads.error)} />
        ) : threads.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-paper-2" />
        ) : (threads.data ?? []).length === 0 ? (
          <EmptyState
            title="گفتگویی نیست"
            hint="با انتخاب مشتری می‌توانید گفتگوی یک‌به‌یک را شروع کنید."
          />
        ) : (
          <ul className="space-y-2">
            {(threads.data ?? []).map((t) => (
              <li key={t.customer.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t.customer.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-right shadow-card"
                >
                  <div className="grid size-11 place-items-center rounded-full bg-paper-2 text-sm font-semibold">
                    {t.customer.firstName.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">
                        {customerFullName(t.customer.firstName, t.customer.lastName)}
                      </p>
                      <span className="text-xs text-ink-faint">
                        {t.lastMessage ? formatTime(t.lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    <p className="truncate text-sm text-ink-soft">
                      {t.lastMessage?.body ?? displayPhone(t.customer.phone)}
                    </p>
                  </div>
                  {t.unreadCount > 0 ? (
                    <span className="grid min-w-6 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-[11px] text-brand-fg">
                      {t.unreadCount}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Chat({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const messages = useQuery({
    queryKey: ["messages", customerId],
    queryFn: () => listSellerMessages({ data: { customerId } }),
  });
  const threads = useQuery({
    queryKey: ["threads", ""],
    queryFn: () => listSellerThreads({ data: { q: "" } }),
  });
  const customer = threads.data?.find((t) => t.customer.id === customerId)?.customer;
  const send = useMutation({
    mutationFn: () => sendSellerChat({ data: { customerId, body } }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["messages", customerId] });
      void qc.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (e) => toast.error(toFaError(e)),
  });

  useEffect(() => {
    void readSellerThread({ data: { customerId } }).then(() => {
      void qc.invalidateQueries({ queryKey: ["threads"] });
      void qc.invalidateQueries({ queryKey: ["seller-state"] });
    });
  }, [customerId, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button type="button" className="h-10 px-2 text-sm" onClick={onBack}>
          بازگشت
        </button>
        <div>
          <p className="font-medium">
            {customer ? customerFullName(customer.firstName, customer.lastName) : "گفتگو"}
          </p>
          {customer ? (
            <p className="text-xs text-ink-faint" dir="ltr">
              {displayPhone(customer.phone)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {(messages.data ?? []).map((m) => {
          const mine = m.senderRole === "seller";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-md bg-brand text-brand-fg" : "rounded-bl-md bg-surface shadow-card"}`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-brand-fg/70" : "text-ink-faint"}`}>
                  {formatTime(m.createdAt)}
                  {mine ? (m.readAt ? " · خوانده‌شد" : m.deliveredAt ? " · رسید" : " · ارسال شد") : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          send.mutate();
        }}
      >
        <input
          className={inputClass}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="پیام به مشتری…"
        />
        <button
          type="submit"
          disabled={send.isPending}
          className="grid size-12 place-items-center rounded-xl bg-brand text-brand-fg"
          aria-label="ارسال"
        >
          <Send className="size-4 rotate-180" />
        </button>
      </form>
    </div>
  );
}
