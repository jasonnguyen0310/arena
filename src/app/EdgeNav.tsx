"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/edge", label: "Checklist" },
  { href: "/levels", label: "Levels" },
  { href: "/playbook", label: "Playbook" },
  { href: "/principles", label: "Principles" },
] as const;

export default function EdgeNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex items-center gap-1 border-b border-border/60 pb-2 text-sm">
      <span className="mr-3 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
        Edge
      </span>
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-md px-3 py-1.5 transition-colors"
            style={{
              color: active ? "#93C5FD" : "var(--color-muted)",
              background: active ? "rgba(147,197,253,0.08)" : "transparent",
              border: active
                ? "1px solid rgba(147,197,253,0.28)"
                : "1px solid transparent",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
