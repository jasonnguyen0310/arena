import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { db, schema } from "@/db";
import { computePendingPayouts } from "@/lib/payouts";
import HideToggle from "./HideToggle";
import ArenaLogo from "./ArenaLogo";
import EntryGate from "./EntryGate";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Arena",
  description: "Pre-trade intent, post-trade reflection, and the patterns in between.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [allTrades, withdrawals, trims] = await Promise.all([
    db.query.trades.findMany(),
    db.query.withdrawals.findMany(),
    db.query.trade_trims.findMany(),
  ]);
  const pending = computePendingPayouts(allTrades, withdrawals, trims);
  const hasPending = pending.length > 0;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var h=localStorage.getItem('arena.hidePnl');if(h!== '0')document.documentElement.classList.add('hide-pnl');var f=localStorage.getItem('arena.freshSlate');if(f==='1')document.documentElement.classList.add('fresh-slate');}catch(e){document.documentElement.classList.add('hide-pnl');}",
          }}
        />
      </head>
      <body>
        <EntryGate />
        <header className="border-b border-border/60">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <ArenaLogo
                size={22}
                dotColor={hasPending ? "#4ADE80" : "#ffffff"}
                pulse={hasPending}
              />
              <span
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Arena
              </span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              {hasPending && (
                <Link
                  href="/#payouts"
                  className="chip mr-2"
                  data-on="true"
                  title={`${pending.length} unpaid green day${pending.length === 1 ? "" : "s"}`}
                >
                  <span style={{ color: "#4ADE80" }}>
                    {pending.length} payout{pending.length === 1 ? "" : "s"} pending
                  </span>
                </Link>
              )}
              <Link href="/" className="nav-link">Overview</Link>
              <Link href="/trades" className="nav-link">Journal</Link>
              <Link href="/edge" className="nav-link">Edge</Link>
              <Link href="/options-lab" className="nav-link">Lab</Link>
              <Link href="/new" className="btn btn-primary ml-2">New trade</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div
            className="mb-6 rounded-2xl px-6 py-6 text-center"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,255,255,0.06), rgba(255,255,255,0) 70%)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex justify-center">
              <ArenaLogo
                size={40}
                strokeWidth={1.4}
                dotColor={hasPending ? "#4ADE80" : "#ffffff"}
                pulse={hasPending}
              />
            </div>
            <div
              className="mt-3 text-lg tracking-[0.32em] text-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              WELCOME TO THE ARENA
            </div>
            <div className="mt-1.5 text-[0.72rem] uppercase tracking-[0.28em] text-muted">
              Stay focused.
            </div>
          </div>

          {children}
        </main>
        <HideToggle />
      </body>
    </html>
  );
}
