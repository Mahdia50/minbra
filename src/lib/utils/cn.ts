import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Joins truthy class fragments — handy for conditional Tailwind lists. */
export function cx(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}
