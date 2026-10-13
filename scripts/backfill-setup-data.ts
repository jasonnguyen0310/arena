/**
 * Backfill setup_type + criteria fields on existing trades by keyword-matching
 * the thesis text. Runs against ~/arena/data/arena.db directly.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-setup-data.ts          # DRY RUN
 *   node --experimental-strip-types scripts/backfill-setup-data.ts --apply  # write to DB
 *
 * The script only sets fields that are currently null. It never overwrites
 * a value you've already set manually.
 */

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data/arena.db");
const apply = process.argv.includes("--apply");

type Row = {
  id: number;
  ticker: string;
  thesis: string;
  setup_type: string | null;
  criteria_coiling: number | null;
  criteria_resistance: number | null;
  criteria_hh_hl: number | null;
  criteria_rel_strength: number | null;
  criteria_news: number | null;
  on_watchlist: number | null;
  key_level: number | null;
};

type Inference = {
  setup_type?: string;
  criteria_coiling?: 1;
  criteria_resistance?: 1;
  criteria_hh_hl?: 1;
  criteria_rel_strength?: 1;
  criteria_news?: 1;
  on_watchlist?: 1;
  key_level?: number;
};

function infer(thesis: string): Inference {
  const t = thesis.toLowerCase();
  const out: Inference = {};

  // ── Setup type ──
  const hasBreakout = /(?:broke\s*out|break\s*out|breakout|breakouts)/i.test(t);
  const hasRetest = /(?:retest|tested|holding|held above|held the)/i.test(t);
  const hasReclaim = /(?:reclaim|undercut|reclaims|reclaimed)/i.test(t);
  const isRoll = /^\s*(?:roll\b|rolls\b)/i.test(t);
  const isEarnings = /(?:earnings\s+(?:play|report|beat|miss)|earnings\b|post[- ]earnings|pre[- ]earnings|ER\b|after earnings|guidance|report(?:ed)?\s+earnings)/i.test(t);

  if (isRoll) {
    out.setup_type = "roll";
  } else if (isEarnings) {
    out.setup_type = "earnings";
  } else if (hasReclaim) {
    out.setup_type = "undercut_reclaim";
  } else if (hasBreakout && hasRetest) {
    out.setup_type = "break_retest_break";
  } else if (hasBreakout) {
    out.setup_type = "initial_breakout";
  } else if (hasRetest) {
    out.setup_type = "break_retest_break";
  }

  // ── Criteria ──
  if (/(?:coil|coiling|consolidat|compression|tight range|choppy)/i.test(t)) {
    out.criteria_coiling = 1;
  }
  if (/(?:key[- ]?level|resistance|key\s+resistance|support level|major level|magnet)/i.test(t)) {
    out.criteria_resistance = 1;
  }
  if (/(?:higher high|higher low|hh|hl\b|\bhh\/hl\b|hh\s+and\s+hl|hh-hl)/i.test(t)) {
    out.criteria_hh_hl = 1;
  }
  if (/(?:relative strength|rel\s+strength|strong(?:est)?\b|outperform|leader|holding well|holding strong)/i.test(t)) {
    out.criteria_rel_strength = 1;
  }
  if (/(?:earnings|catalyst|news|upgrade|downgrade|beat\b|miss(?:ed)?\b|inclusion|announcement|guidance|report(?:ed)?|analyst day|guide|filing|ceo|partnership)/i.test(t)) {
    out.criteria_news = 1;
  }

  // ── On watchlist / pre-planned vs reactive ──
  // "Tailed X" or "ROLL" suggests reactive, not on personal watchlist.
  if (/(?:my watchlist|on\s+watchlist|planned|been watching|been eyeing)/i.test(t)) {
    out.on_watchlist = 1;
  }

  // ── Key level: pick the first 3-5 digit number in the thesis ──
  // (Skips single-digit or 2-digit noise; also skips date-like patterns.)
  const numMatch = thesis.match(/\b(\d{3,5}(?:\.\d+)?)\b/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (n > 5 && n < 100000) out.key_level = n;
  }

  return out;
}

function main() {
  const db = new Database(dbPath, { readonly: !apply });
  const rows = db
    .prepare<[], Row>(
      `SELECT id, ticker, thesis, setup_type, criteria_coiling, criteria_resistance,
              criteria_hh_hl, criteria_rel_strength, criteria_news, on_watchlist, key_level
       FROM trades`,
    )
    .all();

  let counted = {
    setup_type: 0,
    coiling: 0,
    resistance: 0,
    hh_hl: 0,
    rel_strength: 0,
    news: 0,
    watchlist: 0,
    key_level: 0,
  };
  const updates: { id: number; sets: string[]; params: (string | number)[] }[] = [];

  for (const row of rows) {
    const g = infer(row.thesis || "");
    const sets: string[] = [];
    const params: (string | number)[] = [];

    if (g.setup_type && row.setup_type == null) {
      sets.push("setup_type = ?");
      params.push(g.setup_type);
      counted.setup_type++;
    }
    if (g.criteria_coiling && row.criteria_coiling == null) {
      sets.push("criteria_coiling = 1");
      counted.coiling++;
    }
    if (g.criteria_resistance && row.criteria_resistance == null) {
      sets.push("criteria_resistance = 1");
      counted.resistance++;
    }
    if (g.criteria_hh_hl && row.criteria_hh_hl == null) {
      sets.push("criteria_hh_hl = 1");
      counted.hh_hl++;
    }
    if (g.criteria_rel_strength && row.criteria_rel_strength == null) {
      sets.push("criteria_rel_strength = 1");
      counted.rel_strength++;
    }
    if (g.criteria_news && row.criteria_news == null) {
      sets.push("criteria_news = 1");
      counted.news++;
    }
    if (g.on_watchlist && row.on_watchlist == null) {
      sets.push("on_watchlist = 1");
      counted.watchlist++;
    }
    if (g.key_level != null && row.key_level == null) {
      sets.push("key_level = ?");
      params.push(g.key_level);
      counted.key_level++;
    }

    if (sets.length > 0) {
      updates.push({ id: row.id, sets, params });
    }
  }

  console.log(`\nScanned ${rows.length} trades. Proposed updates:`);
  console.log(`  setup_type:            ${counted.setup_type}`);
  console.log(`  criteria_coiling:      ${counted.coiling}`);
  console.log(`  criteria_resistance:   ${counted.resistance}`);
  console.log(`  criteria_hh_hl:        ${counted.hh_hl}`);
  console.log(`  criteria_rel_strength: ${counted.rel_strength}`);
  console.log(`  criteria_news:         ${counted.news}`);
  console.log(`  on_watchlist:          ${counted.watchlist}`);
  console.log(`  key_level:             ${counted.key_level}`);
  console.log(`\nTotal rows touched: ${updates.length}`);

  if (!apply) {
    console.log(`\nDRY RUN — no changes written. Pass --apply to persist.`);
    // Show a few sample inferences
    console.log(`\nSample inferences (first 8 with changes):`);
    for (const u of updates.slice(0, 8)) {
      const row = rows.find((r) => r.id === u.id)!;
      console.log(
        `  #${row.id} ${row.ticker}  →  ${u.sets.join(", ").replace(/= \?/g, (m) => `= ${u.params.shift()}`)}`,
      );
    }
    return;
  }

  const tx = db.transaction((rows: typeof updates) => {
    for (const u of rows) {
      const stmt = db.prepare(`UPDATE trades SET ${u.sets.join(", ")} WHERE id = ?`);
      stmt.run(...u.params, u.id);
    }
  });
  tx(updates);
  console.log(`\n✅ Applied ${updates.length} row updates.`);
}

main();
