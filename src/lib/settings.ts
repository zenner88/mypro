import { db } from "@/lib/db";

export const DEFAULT_SETTINGS: Record<string, string> = {
  // Business
  business_name: "",
  business_address: "",
  business_email: "",
  business_phone: "",
  business_website: "",
  business_logo: "",
  // Invoice
  invoice_prefix: "INV",
  invoice_number_format: "{PREFIX}-{YEAR}-{NUMBER}",
  invoice_starting_number: "1",
  invoice_default_tax_percent: "0",
  invoice_default_payment_terms_days: "7",
  invoice_notes: "Thank you for your business.",
  // Payment / bank
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  payment_instructions: "",
  // System
  timezone: "Asia/Jakarta",
  currency: "IDR",
  date_format: "DD/MM/YYYY",
};

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getSetting(key: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function setSettings(values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values);
  await db.$transaction(
    entries.map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );
}
