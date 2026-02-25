"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { design } from "@/lib/design";
import { Pen } from "lucide-react";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ backgroundColor: design.colors.bg.primary }}>
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: design.colors.brand.primary }}
          >
            <Pen className="w-5 h-5 text-white animate-spin-slow" strokeWidth={2} />
          </div>
          <p className="text-[13px]" style={{ color: design.colors.text.muted }}>
            Loading Drafta AI...
          </p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <AppShell />;
}
