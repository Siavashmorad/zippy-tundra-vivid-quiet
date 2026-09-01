import { parseContactLines, type ParsedContact } from "@/lib/toranj/phone";

type ContactPickerNav = Navigator & {
  contacts?: {
    select: (
      props: string[],
      opts?: { multiple?: boolean },
    ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
  };
};

export function contactsPickerAvailable(): boolean {
  return typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;
}

export async function pickDeviceContacts(): Promise<ParsedContact[]> {
  const nav = navigator as ContactPickerNav;
  if (!nav.contacts) throw new Error("دسترسی به مخاطبین روی این دستگاه در دسترس نیست.");
  const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
  const lines = picked.flatMap((c) => {
    const name = (c.name ?? []).join(" ");
    return (c.tel ?? []).map((tel) => `${name} ${tel}`);
  });
  return parseContactLines(lines.join("\n"));
}

export function parseVcard(text: string): ParsedContact[] {
  const blocks = text.split(/BEGIN:VCARD/i);
  const lines: string[] = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const fn = block.match(/^FN[;:][^\n]*:?(.+)$/im)?.[1]?.trim() ?? "";
    const tels = [...block.matchAll(/^TEL[^:]*:(.+)$/gim)].map((m) => m[1]!.trim());
    for (const tel of tels) lines.push(`${fn} ${tel}`);
  }
  return parseContactLines(lines.join("\n"));
}
