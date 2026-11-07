"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const BASE =
  "w-full bg-base/70 border border-line rounded-[14px] px-4 text-ink placeholder:text-faint " +
  "transition-colors duration-200 focus:border-brand/70 focus:bg-base focus:outline-none " +
  "disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(BASE, "h-11", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(BASE, "py-3 leading-relaxed resize-none", className)} {...rest} />;
  },
);
