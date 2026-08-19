import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/shared/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Giris",
  description: "AI Destekli Egitim Sistemi'ne giris yapin.",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-muted-foreground">
            AI Destekli Egitim Sistemi
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Hesabiniza giris yapin</CardTitle>
            <CardDescription>
              Rolunuze uygun panel otomatik olarak acilir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Sorun mu yasiyorsunuz? <code className="font-mono">supabase/schema.sql</code>{" "}
          dosyasinin calistirildigindan emin olun.
        </p>
      </div>
    </main>
  );
}
