import type { Metadata, Viewport } from "next";
import { Cairo, Reem_Kufi } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const kufi = Reem_Kufi({
  variable: "--font-kufi",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "مين برّة السالفة",
    template: "%s · مين برّة السالفة",
  },
  description:
    "لعبة جماعية أونلاين: كل اللاعبين يعرفون الكلمة السرية إلا واحدًا — «خارج السالفة». تلميح واحد، نقاش، ثم تصويت. اكشفوا الدخيل أو غالطوا الجميع.",
  applicationName: "مين برّة السالفة",
  keywords: ["لعبة جماعية", "لعبة أونلاين", "خارج السالفة", "كلمات سرية", "دارجة مغربية"],
  openGraph: {
    title: "مين برّة السالفة",
    description: "لعبة الاستنتاج الجماعية الأونلاين — اكشف من هو خارج السالفة.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${kufi.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-base text-ink">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
