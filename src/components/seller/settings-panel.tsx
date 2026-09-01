import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth/client";
import { saveCardInfo, saveShopProfile } from "@/lib/toranj/api/shop";
import { simulateCustomerOrder } from "@/lib/toranj/api/orders";
import { toFaError } from "@/lib/toranj/errors";
import { parseOrderLines } from "@/lib/toranj/parse-items";
import { enablePush } from "@/lib/toranj/client/push";
import type { SellerBootstrap } from "@/lib/toranj/types";
import { SELLER_APP_VERSION } from "@/lib/toranj/version";
import { toast } from "sonner";
import { Btn, Field, Sheet, inputClass } from "./ui";

export function SettingsPanel({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: SellerBootstrap;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(state.shop.name);
  const [phone, setPhone] = useState(state.shop.phone);
  const [holder, setHolder] = useState(state.card.holderName);
  const [card, setCard] = useState(state.card.cardNumber);
  const [bank, setBank] = useState(state.card.bankName);
  const [extra, setExtra] = useState(state.card.extraInfo);
  const [simName, setSimName] = useState("سارا");
  const [simPhone, setSimPhone] = useState("09120000000");
  const [simItems, setSimItems] = useState("موز — ۱ کیلو\nتخم‌مرغ — ۲ بسته");
  const [pushStatus, setPushStatus] = useState("");

  const saveShop = useMutation({
    mutationFn: () => saveShopProfile({ data: { name, phone, displayName: name } }),
    onSuccess: () => {
      toast.success("مشخصات فروشگاه ذخیره شد.");
      void qc.invalidateQueries({ queryKey: ["seller-state"] });
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  const saveCard = useMutation({
    mutationFn: () =>
      saveCardInfo({
        data: { holderName: holder, cardNumber: card, bankName: bank, extraInfo: extra },
      }),
    onSuccess: () => {
      toast.success("اطلاعات کارت ذخیره شد.");
      void qc.invalidateQueries({ queryKey: ["seller-state"] });
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  const sim = useMutation({
    mutationFn: () =>
      simulateCustomerOrder({
        data: {
          phone: simPhone,
          firstName: simName,
          lastName: "",
          items: parseOrderLines(simItems),
        },
      }),
    onSuccess: () => {
      toast.success("سفارش از مسیر اپ مشتری ثبت شد.");
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(toFaError(e)),
  });

  return (
    <Sheet open={open} onClose={onClose} title="تنظیمات فروشگاه">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">هویت فروشگاه</h3>
          <Field label="نام فروشگاه">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="شماره فروشگاه">
            <input
              className={inputClass}
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <p className="text-xs text-ink-faint">
            کد فروشگاه برای اپ مشتری: <span dir="ltr">{state.shop.publicCode}</span>
          </p>
          <Btn className="w-full" onClick={() => saveShop.mutate()} disabled={saveShop.isPending}>
            ذخیره مشخصات
          </Btn>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">کارت‌به‌کارت</h3>
          <Field label="نام صاحب کارت">
            <input className={inputClass} value={holder} onChange={(e) => setHolder(e.target.value)} />
          </Field>
          <Field label="شماره کارت">
            <input className={inputClass} dir="ltr" value={card} onChange={(e) => setCard(e.target.value)} />
          </Field>
          <Field label="بانک">
            <input className={inputClass} value={bank} onChange={(e) => setBank(e.target.value)} />
          </Field>
          <Field label="توضیح پرداخت">
            <input className={inputClass} value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
          <Btn className="w-full" onClick={() => saveCard.mutate()} disabled={saveCard.isPending}>
            ذخیره کارت
          </Btn>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">اعلان‌ها</h3>
          <p className="text-sm text-ink-soft">
            برای سفارش و پیام جدید، حتی وقتی برنامه در پس‌زمینه است، اعلان را فعال کنید.
          </p>
          <Btn
            variant="line"
            className="w-full"
            onClick={async () => {
              try {
                const res = await enablePush();
                if (res === "granted") {
                  setPushStatus("اعلان‌ها فعال شد.");
                  toast.success("اعلان‌ها فعال شد.");
                } else if (res === "denied") {
                  setPushStatus("اجازه اعلان داده نشد.");
                } else {
                  setPushStatus("اعلان روی این دستگاه پشتیبانی نمی‌شود (HTTPS لازم است).");
                }
              } catch (e) {
                toast.error(toFaError(e));
              }
            }}
          >
            فعال‌سازی اعلان
          </Btn>
          {pushStatus ? <p className="text-xs text-ink-faint">{pushStatus}</p> : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">نصب روی گوشی</h3>
          <p className="text-sm text-ink-soft">
            از منوی مرورگر «افزودن به صفحه اصلی» را بزنید تا نام برنامه «فروشنده ترنج» روی گوشی دیده شود. فایل نصب اندروید هم از بخش دانلود در دسترس است.
          </p>
          <a
            href="/toranj-seller.apk"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-line text-sm"
          >
            دانلود فایل نصب اندروید
          </a>
        </section>

        <section className="space-y-3 rounded-2xl bg-paper p-3">
          <h3 className="text-sm font-semibold">آزمایش مسیر اپ مشتری</h3>
          <p className="text-xs text-ink-soft">
            این دکمه همان API واقعی اپ مشتری را صدا می‌زند تا قبل از ساخت اپ مشتری، دریافت سفارش تست شود.
          </p>
          <Field label="نام مشتری آزمایشی">
            <input className={inputClass} value={simName} onChange={(e) => setSimName(e.target.value)} />
          </Field>
          <Field label="شماره">
            <input className={inputClass} dir="ltr" value={simPhone} onChange={(e) => setSimPhone(e.target.value)} />
          </Field>
          <Field label="اقلام">
            <textarea
              className={`${inputClass} h-24 py-3`}
              value={simItems}
              onChange={(e) => setSimItems(e.target.value)}
            />
          </Field>
          <Btn className="w-full" onClick={() => sim.mutate()} disabled={sim.isPending}>
            ارسال سفارش آزمایشی
          </Btn>
        </section>

        <section className="space-y-2 text-sm text-ink-soft">
          <p>نسخه برنامه: {SELLER_APP_VERSION}</p>
          <p>آخرین نسخه سرور: {state.latestVersion}</p>
          {state.latestVersion !== state.appVersion ? (
            <p className="text-brand">نسخه جدید آماده است. برنامه را به‌روز کنید. اطلاعات سفارش‌ها روی سرور می‌ماند.</p>
          ) : (
            <p>برنامه به‌روز است.</p>
          )}
        </section>

        <Btn
          variant="danger"
          className="w-full"
          onClick={() => void signOut("/login").catch((e) => toast.error(toFaError(e)))}
        >
          خروج از حساب
        </Btn>
      </div>
    </Sheet>
  );
}
