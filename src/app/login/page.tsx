"use client";

import * as React from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [regStep, setRegStep] = React.useState<"details" | "otp">("details");

  // Form states
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);

  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      toast({ title: "Login gagal", description: "Email atau password salah.", variant: "error" });
    } else {
      router.replace("/dashboard");
      router.refresh();
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setDevOtp(null);

    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    setLoading(false);
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      toast({
        title: "Kode OTP Dikirim 📩",
        description: data.message,
        variant: "success",
      });
      if (data.devCode) setDevOtp(data.devCode);
      setRegStep("otp");
    } else {
      toast({ title: "Gagal Mengirim OTP", description: data.error, variant: "error" });
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      toast({ title: "Kode OTP Harus 6-digit", variant: "error" });
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, otp: otpCode }),
    });

    setLoading(false);
    if (res.ok) {
      toast({
        title: "Pendaftaran Berhasil 🎉",
        description: "Email terverifikasi. Mengalihkan ke dashboard...",
        variant: "success",
      });
      // Auto sign in
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setMode("login");
      }
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Verifikasi OTP Gagal", description: d.error, variant: "error" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
            <span className="text-2xl font-black">M</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">MYPro</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            SaaS Project &amp; Billing Management
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="mb-4 flex rounded-xl bg-slate-200/80 p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setRegStep("details"); }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
              mode === "login" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Masuk Akun
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
              mode === "register" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Daftar Gratis
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-slate-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl border-slate-200"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Ingat saya selama 30 hari
            </label>
            <Button type="submit" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold" disabled={loading}>
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        ) : regStep === "details" ? (
          <form onSubmit={handleSendOtp} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name" className="text-xs font-bold text-slate-700">Nama Lengkap</Label>
              <Input
                id="reg-name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email" className="text-xs font-bold text-slate-700">Email</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-password" className="text-xs font-bold text-slate-700">Password (min. 8 karakter)</Label>
              <Input
                id="reg-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="rounded-xl border-slate-200"
              />
            </div>
            <Button type="submit" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold shadow-md shadow-emerald-600/20" disabled={loading}>
              {loading ? "Mengirim Kode OTP..." : "Kirim Kode OTP Email"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Verifikasi Email Anda</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kode OTP 6-digit telah dikirim ke <span className="font-bold text-slate-800">{email}</span>.
              </p>
              {devOtp && (
                <div className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] font-bold text-amber-800 border border-amber-200">
                  💡 Dev Mode OTP: <span className="tracking-widest text-emerald-700">{devOtp}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="otp-code" className="text-xs font-bold text-slate-700">Kode OTP (6-digit)</Label>
              <Input
                id="otp-code"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                required
                className="rounded-xl border-slate-200 text-center font-mono text-xl tracking-widest"
              />
            </div>

            <Button type="submit" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold shadow-md shadow-emerald-600/20" disabled={loading}>
              {loading ? "Memverifikasi..." : "Verifikasi OTP & Buat Akun"}
            </Button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setRegStep("details")}
                className="font-semibold text-slate-500 hover:text-slate-800"
              >
                ← Ganti Email
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="font-bold text-emerald-600 hover:text-emerald-700"
              >
                Kirim Ulang OTP
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400 font-medium">
          MYPro SaaS v1.0 — Freelancer Project &amp; Billing
        </p>
      </div>
    </div>
  );
}
