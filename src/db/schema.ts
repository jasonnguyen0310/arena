import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  opened_at: integer("opened_at", { mode: "timestamp" }).notNull(),
  closed_at: integer("closed_at", { mode: "timestamp" }),

  ticker: text("ticker").notNull(),
  instrument: text("instrument", {
    enum: ["stock", "call", "put", "call_spread", "put_spread", "other"],
  }).notNull(),
  direction: text("direction", { enum: ["long", "short"] }).notNull(),

  strike: real("strike"),
  expiration: text("expiration"),

  planned_size: real("planned_size").notNull(),
  planned_entry: real("planned_entry"),
  planned_stop: real("planned_stop"),
  planned_target: real("planned_target"),
  planned_target_2: real("planned_target_2"),
  planned_target_3: real("planned_target_3"),
  // JSON array of take-profit price levels (dynamic length). Supersedes the
  // 3 numbered columns above; those are kept so historical rows still read.
  planned_targets: text("planned_targets"),

  thesis: text("thesis").notNull(),
  emotion_before: text("emotion_before", {
    enum: ["calm", "confident", "anxious", "fomo", "revenge", "greedy", "fearful", "bored"],
  }).notNull(),
  conviction: integer("conviction").notNull(),

  // ── Setup data (pre-trade) — captures the "why this, why now" system ──
  setup_type: text("setup_type", {
    enum: [
      "initial_breakout",
      "break_retest_break",
      "break_retest_hod",
      "undercut_reclaim",
      "earnings",
      "news",
      "roll",
      "bottom_rr",
      "dip_buy",
      "other",
    ],
  }),
  criteria_coiling: integer("criteria_coiling"), // 0/1
  criteria_resistance: integer("criteria_resistance"), // 0/1
  criteria_hh_hl: integer("criteria_hh_hl"), // 0/1
  criteria_rel_strength: integer("criteria_rel_strength"), // 0/1
  criteria_news: integer("criteria_news"), // 0/1 — news / catalyst driving the move
  criteria_support: integer("criteria_support"), // 0/1 — support at key level
  key_level: real("key_level"),
  on_watchlist: integer("on_watchlist"), // 0/1
  // Market regime at the time of entry — SPX/QQQ behavior.
  market_regime: text("market_regime", {
    enum: ["cooperating", "sideways", "dumping", "mixed"],
  }),

  actual_entry: real("actual_entry"),
  exit_price: real("exit_price"),
  pnl: real("pnl"),
  outcome: text("outcome", { enum: ["win", "loss", "scratch"] }),
  emotion_after: text("emotion_after", {
    enum: ["calm", "relieved", "euphoric", "frustrated", "regretful", "disappointed", "vindicated", "fearful", "numb"],
  }),
  market_context: text("market_context"),
  rules_followed: text("rules_followed"),
  rules_broken: text("rules_broken"),
  trims: text("trims"),
  lesson: text("lesson"),

  // ── Outcome data (post-trade) — captures how it actually played out ──
  exit_strategy: text("exit_strategy", {
    enum: [
      "hit_target",
      "trimmed_strength",
      "stopped_out",
      "time_exit",
      "panic_exit",
      "other",
    ],
  }),
  setup_worked: text("setup_worked", { enum: ["yes", "no", "partial"] }),
});

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

// Structured trims: each row is a partial exit / trim on a trade.
export const trade_trims = sqliteTable("trade_trims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trade_id: integer("trade_id")
    .notNull()
    .references(() => trades.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  contracts: real("contracts").notNull(),
  price: real("price").notNull(),
  pnl: real("pnl"),
  why: text("why"),
  emotion_after: text("emotion_after", {
    enum: ["calm", "relieved", "euphoric", "frustrated", "regretful", "disappointed", "vindicated", "fearful", "numb"],
  }),
  at: integer("at", { mode: "timestamp" }).notNull(),
});

export type TradeTrim = typeof trade_trims.$inferSelect;

// Screenshots attached to a trade — chart snapshots, broker fills, etc.
// Files live on disk under data/screenshots/, DB stores the metadata.
export const trade_screenshots = sqliteTable("trade_screenshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trade_id: integer("trade_id")
    .notNull()
    .references(() => trades.id, { onDelete: "cascade" }),
  filename: text("filename").notNull().unique(),
  mime_type: text("mime_type").notNull(),
  caption: text("caption"),
  size_bytes: integer("size_bytes").notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type TradeScreenshot = typeof trade_screenshots.$inferSelect;

export const tradesRelations = relations(trades, ({ many }) => ({
  trims: many(trade_trims),
}));

export const tradeTrimsRelations = relations(trade_trims, ({ one }) => ({
  trade: one(trades, { fields: [trade_trims.trade_id], references: [trades.id] }),
}));

// Daily state — where you sit on the fear ↔ zone ↔ euphoria spectrum.
// Gauge: -3 (paralyzed by fear) ... 0 (in the zone) ... +3 (euphoric / reckless).
export const daily_states = sqliteTable("daily_states", {
  date: text("date").primaryKey(), // yyyy-mm-dd
  gauge: integer("gauge").notNull(),
  note: text("note"),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type DailyState = typeof daily_states.$inferSelect;

// 60/40 withdrawal rule log — records that you actually took profits out.
// Multiple rows per date allowed (e.g., partial payout in the morning, top-up later).
export const withdrawals = sqliteTable("withdrawals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // yyyy-mm-dd, the green day it's for
  day_pnl: real("day_pnl").notNull(),
  withdraw_amount: real("withdraw_amount").notNull(),
  kept_amount: real("kept_amount").notNull(),
  acknowledged_at: integer("acknowledged_at", { mode: "timestamp" }).notNull(),
});

export type Withdrawal = typeof withdrawals.$inferSelect;

// Simple key-value settings (tax_rate, etc.)
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Trade ideas — pre-trade plans so you can see later if you followed the
// plan or chased. Each row is a single ticker idea tied to a planned_date.
// `targets` is a JSON array of take-profit price levels.
// `trade_id` optionally links back to the actual trade if/when it fired.
export const trade_ideas = sqliteTable("trade_ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planned_date: text("planned_date").notNull(), // yyyy-mm-dd
  ticker: text("ticker").notNull(),
  direction: text("direction", { enum: ["long", "short"] }).notNull(),
  trigger_level: real("trigger_level"),
  invalidation: real("invalidation"),
  targets: text("targets"),        // JSON array of numbers
  catalyst: text("catalyst"),
  setup_type: text("setup_type"),  // mirrors SETUP_TYPES; stored as plain text so adding new setups doesn't require migration
  sizing_tier: integer("sizing_tier"),
  status: text("status", {
    enum: ["planned", "executed", "passed", "invalidated"],
  }).notNull().default("planned"),
  trade_id: integer("trade_id").references(() => trades.id, { onDelete: "set null" }),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type TradeIdea = typeof trade_ideas.$inferSelect;
export type NewTradeIdea = typeof trade_ideas.$inferInsert;

// Weekly bias — one row per Monday with your top-down read for the week.
export const weekly_plans = sqliteTable("weekly_plans", {
  week_start: text("week_start").primaryKey(), // yyyy-mm-dd of Monday
  spx_bias: text("spx_bias"),
  qqq_bias: text("qqq_bias"),
  smh_bias: text("smh_bias"),
  macro_calendar: text("macro_calendar"),
  notes: text("notes"),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type WeeklyPlan = typeof weekly_plans.$inferSelect;

// Macro event journal — CPI, PPI, FOMC prints with expectations, actuals,
// and qualitative notes on how the market reacted into the print and out of it.
export const macro_events = sqliteTable("macro_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  event_date: text("event_date").notNull(), // yyyy-mm-dd of the release
  event_type: text("event_type", {
    enum: ["CPI", "PPI", "FOMC", "NFP", "GDP", "other"],
  }).notNull(),
  expectations: text("expectations"), // what the Street was pricing in
  actual: text("actual"),              // what came out
  surprise: text("surprise", {
    enum: ["hot", "cold", "in_line"],
  }),
  days_before: text("days_before"),    // how SPX/QQQ traded into the print
  days_after: text("days_after"),      // reaction after the print
  // deprecated — replaced by per-index columns below, kept for schema compat
  indices_behavior: text("indices_behavior", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  // Legacy single-value per-index behavior — kept for schema compat with
  // existing rows. Superseded by the explicit _before / _after columns below.
  spx_behavior: text("spx_behavior", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  qqq_behavior: text("qqq_behavior", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  smh_behavior: text("smh_behavior", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  // Per-index behavior split into pre-print tape and post-print reaction.
  spx_behavior_before: text("spx_behavior_before", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  spx_behavior_after: text("spx_behavior_after", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  qqq_behavior_before: text("qqq_behavior_before", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  qqq_behavior_after: text("qqq_behavior_after", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  smh_behavior_before: text("smh_behavior_before", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  smh_behavior_after: text("smh_behavior_after", {
    enum: ["ripping", "grinding_up", "sideways", "choppy", "grinding_down", "dumping"],
  }),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type MacroEvent = typeof macro_events.$inferSelect;
export type NewMacroEvent = typeof macro_events.$inferInsert;

// Key levels tracked per ticker — support, resistance, breakout target, etc.
export const key_levels = sqliteTable("key_levels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  price: real("price").notNull(),
  label: text("label", {
    enum: ["support", "resistance", "breakout", "target", "invalidation", "other"],
  }).notNull(),
  note: text("note"),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type KeyLevel = typeof key_levels.$inferSelect;
