import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function parseIntOr(value: string | null | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isNaN(n) ? fallback : n;
}
