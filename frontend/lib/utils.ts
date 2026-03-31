import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBHD(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-BH", {
    style: "currency",
    currency: "BHD",
    minimumFractionDigits: 3,
  }).format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

export function confidenceClass(score: number): string {
  if (score >= 80) return "confidence-high";
  if (score >= 60) return "confidence-mid";
  return "confidence-low";
}

export function confidenceLabel(score: number): string {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

export function truncate(str: string, len = 40): string {
  return str.length > len ? str.slice(0, len) + "…" : str;
}
