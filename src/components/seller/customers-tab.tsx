import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import {
  getSellerCustomer,
  listSellerCustomers,
  markCustomerSeen,
  saveCustomer,
  syncPhoneContacts,
} from "@/lib/toranj/api/customers";
import { toFaError } from "@/lib/toranj/errors";
import { customerFullName, formatDateTime, itemSummary } from "@/lib/toranj/format";
import { displayPhone, parseContactLines } from "@/lib/toranj/phone";
import { contactsPickerAvailable, parseVcard, pickDeviceContacts } from "@/lib/toranj/client/contacts";
import { toast } from "sonner";
import { Btn, EmptyState, Field, Sheet, StatusBadge, inputClass } from "./ui";

export function CustomersTab({
  selectedId,
  onSelect,
  onMessage,
}: {
  selectedId?: string;
  onSelect: (id?: string) => void;
  onMessage: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["customers", q],
    queryFn: () => listSellerCustomers({ data: { q } }),
  });

  async function syncPicker() {
    try {
      const contacts = await pickDeviceContacts();
      if (contacts.length === 0) {
        toast.error("مخاطب معتبری انتخاب نشد.");
        return;
      }
      const res = await syncPhoneContacts({ data: { contacts } });
      toast.success(`${res.added} مشتری اضافه شد، ${res.skipped} تکراری رد شد.`);
      void qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e) {
      toast.error(toFaError(e));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 px-4 pb-3">
        <input
          className={inputClass}
          placeholder="جستجوی نام یا شماره"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        <Btn onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          مشتری جدید
        </Btn>
        {contactsPickerAvailable() ? (
          <Btn variant="line" onClick={() => void syncPicker()}>
            همگام‌سازی مخاطبین
          </Btn>
        ) : (
          <Btn variant="line" onClick={() => setPasteOpen(true)}>
            <Upload className="size-4" />
            ورود مخاطب
          </Btn>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {list.isError ? (
          <EmptyState title="خطا در دریافت مشتری‌ها" hint={toFaError(list.error)} />
        ) : list.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-paper-2" />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState
            title="هنوز مشتری‌ای ندارید"
            hint="با اجازه شما مخاطبین گوشی همگام می‌شود. مشتری تکراری ساخته نمی‌شود."
            action={<Btn onClick={() => setAdding(true)}>افزودن مشتری</Btn>}
          />
        ) : (
          <ul className="space-y-2">
            {(list.data ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-right shadow-card"
                >
                  <div>
                    <p className="font-medium">
                      {customerFullName(c.firstName, c.lastName)}
                      {c.isNew ? (
                        <span className="mr-2 rounded-full bg-brand px-2 py-0.5 text-[11px] text-brand-fg">
                          جدید
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ink-soft" dir="ltr">
                      {displayPhone(c.phone)}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint">
                    {c.source === "customer_app"
                      ? "از اپ مشتری"
                      : c.source === "contacts"
                        ? "مخاطبین"
                        : "فروشنده"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <CustomerSheet
        id={selectedId}
        onClose={() => onSelect(undefined)}
        onMessage={onMessage}
      />
      <AddCustomerSheet open={adding} onClose={() => setAdding(false)} />
      <PasteContactsSheet open={pasteOpen} onClose={() => setPasteOpen(false)} />
    </div>
  );
}

function CustomerSheet({
  id,
  onClose,
  onMessage,
}: {
  id?: string;
  onClose: () => void;
  onMessage: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const detail = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getSellerCustomer({ data: { id: id! } }),
    enabled: Boolean(id),
  });
  const seen = useMutation({
    mutationFn: () => markCustomerSeen({ data: { id: id! } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["seller-state"] });
      void qc.invalidateQueries({ queryKey: ["customer", id] });
    },
  });
  const save = useMutation({
    mutationFn: () =>
      saveCustomer({
        data: { id: id!, firstName, lastName, phone, address, notes },
      }),
    onSuccess: () => {
      toast.success("مشتری به‌روز شد.");
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer", id] });
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  const customer = detail.data?.customer;

  useEffect(() => {
    if (customer) {
      setFirstName(customer.firstName);
      setLastName(customer.lastName);
      setPhone(customer.phone);
      setAddress(customer.address);
      setNotes(customer.notes);
      setEditing(false);
    }
  }, [customer]);

  return (
    <Sheet open={Boolean(id)} onClose={onClose} title="پرونده مشتری">
      {detail.isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-paper-2" />
      ) : customer ? (
        <div className="space-y-4">
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <Field label="نام">
                <input
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </Field>
              <Field label="نام خانوادگی">
                <input
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
              <Field label="شماره موبایل">
                <input
                  className={inputClass}
                  dir="ltr"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </Field>
              <Field label="آدرس">
                <input
                  className={inputClass}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Field>
              <Field label="یادداشت">
                <textarea
                  className={`${inputClass} h-24 py-3`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Btn type="submit" className="flex-1" disabled={save.isPending}>
                  ذخیره
                </Btn>
                <Btn type="button" variant="line" className="flex-1" onClick={() => setEditing(false)}>
                  انصراف
                </Btn>
              </div>
            </form>
          ) : (
            <>
              <div>
                <p className="text-lg font-semibold">
                  {customerFullName(customer.firstName, customer.lastName)}
                  {customer.isNew ? (
                    <span className="mr-2 rounded-full bg-brand px-2 py-0.5 text-[11px] text-brand-fg">
                      جدید
                    </span>
                  ) : null}
                </p>
                <p dir="ltr" className="text-sm text-ink-soft">
                  {displayPhone(customer.phone)}
                </p>
                {customer.address ? <p className="mt-1 text-sm">{customer.address}</p> : null}
                {customer.notes ? (
                  <p className="mt-2 rounded-xl bg-paper-2 px-3 py-2 text-sm">یادداشت: {customer.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn className="flex-1" onClick={() => onMessage(customer.id)}>
                  پیام
                </Btn>
                <Btn variant="line" className="flex-1" onClick={() => setEditing(true)}>
                  ویرایش
                </Btn>
                {customer.isNew ? (
                  <Btn variant="line" className="flex-1" onClick={() => seen.mutate()}>
                    دیده‌شد
                  </Btn>
                ) : null}
              </div>
            </>
          )}
          <div>
            <p className="mb-2 text-sm font-medium">سابقه سفارش</p>
            {(detail.data?.orders ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">سفارشی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {detail.data!.orders.map((o) => (
                  <li key={o.id} className="rounded-xl bg-paper px-3 py-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={o.status} />
                      <span className="text-xs text-ink-faint">{formatDateTime(o.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm">{o.items.map(itemSummary).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">مشتری پیدا نشد.</p>
      )}
    </Sheet>
  );
}

function AddCustomerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const mut = useMutation({
    mutationFn: () => saveCustomer({ data: { firstName, lastName, phone, address, notes } }),
    onSuccess: () => {
      toast.success("مشتری ثبت شد.");
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setFirstName("");
      setLastName("");
      setPhone("");
      setAddress("");
      setNotes("");
      onClose();
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  return (
    <Sheet open={open} onClose={onClose} title="مشتری جدید">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <Field label="نام">
          <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </Field>
        <Field label="نام خانوادگی">
          <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="شماره موبایل">
          <input
            className={inputClass}
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <Field label="آدرس">
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="یادداشت">
          <textarea
            className={`${inputClass} h-24 py-3`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Btn type="submit" className="w-full" disabled={mut.isPending}>
          ذخیره
        </Btn>
      </form>
    </Sheet>
  );
}

function PasteContactsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const mut = useMutation({
    mutationFn: (contacts: { firstName: string; lastName: string; phone: string }[]) =>
      syncPhoneContacts({ data: { contacts } }),
    onSuccess: (res) => {
      toast.success(`${res.added} مشتری اضافه شد، ${res.skipped} تکراری رد شد.`);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setText("");
      onClose();
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  return (
    <Sheet open={open} onClose={onClose} title="ورود مخاطبین">
      <p className="mb-3 text-sm text-ink-soft">
        مخاطبین فقط با رضایت شما همگام می‌شود. هر خط: نام و شماره. فایل vCard هم قابل انتخاب است.
      </p>
      <textarea
        className={`${inputClass} h-40 py-3`}
        placeholder={"علی رضایی ۰۹۱۲۱۲۳۴۵۶۷"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-line text-sm">
          فایل vCard
          <input
            type="file"
            accept=".vcf,text/vcard"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const raw = await file.text();
              setText((prev) => `${prev}\n${raw}`);
            }}
          />
        </label>
        <Btn
          className="flex-1"
          disabled={mut.isPending}
          onClick={() => {
            const fromText = parseContactLines(text);
            const fromVcf = parseVcard(text);
            const map = new Map<string, (typeof fromText)[0]>();
            for (const c of [...fromVcf, ...fromText]) map.set(c.phone, c);
            const contacts = [...map.values()];
            if (contacts.length === 0) {
              toast.error("شماره معتبری پیدا نشد.");
              return;
            }
            mut.mutate(contacts);
          }}
        >
          همگام‌سازی
        </Btn>
      </div>
    </Sheet>
  );
}
