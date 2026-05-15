"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RECEPTION_PHONE_DISPLAY } from "@/lib/clinic";
import { useAuthStore } from "@/store/auth";

const tabs = [
  { href: "/receptionist/schedule", label: "Schedule", icon: "📅" },
  { href: "/receptionist/patients", label: "Patients", icon: "👥" },
  { href: "/receptionist/book", label: "Book", icon: "➕" },
] as const;

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuth();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3 px-4 py-3.5 sm:max-w-2xl">
          <div>
            <Link href="/receptionist/schedule" className="block">
              <div className="flex items-center gap-2.5">
                <span className="text-xl leading-none text-text" aria-hidden>
                  🦷
                </span>
                <span className="font-display text-[18px] font-bold leading-tight tracking-tight text-text">
                  Dental Hub
                </span>
              </div>
              <p className="mt-1 pl-[2.125rem] text-[11px] font-semibold text-primary">
                Dr. Surbhi&apos;s Clinic
              </p>
              <p className="mt-0.5 pl-[2.125rem] text-[11px] font-medium text-primary">
                {RECEPTION_PHONE_DISPLAY}
              </p>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <span className="rounded-full border border-primary bg-surface-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Receptionist
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="dh-btn-ghost rounded-xl px-3 py-2 text-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-28 sm:max-w-2xl">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-bg pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.45)]"
        aria-label="Receptionist navigation"
      >
        <div className="mx-auto flex max-w-lg sm:max-w-2xl">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-1 flex-col items-center gap-1 px-1 py-3 transition-colors duration-200 ${
                  active ? "text-primary" : "text-text-subtle"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 right-0 top-0 h-0.5 rounded-b-full bg-primary" />
                ) : null}
                <span className="text-2xl leading-none" aria-hidden>
                  {tab.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
