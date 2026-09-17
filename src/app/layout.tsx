import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/session-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "MYPro - Personal Project Management & Billing",
    template: "%s | MYPro",
  },
  description: "Project, invoice, payment and document management for freelancers",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="id" className={plusJakarta.variable}>
      <body className="min-h-screen font-sans bg-[#f8fafc] text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-700">
        <SessionProvider session={session}>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
