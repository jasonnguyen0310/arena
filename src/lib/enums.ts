export const INSTRUMENTS = [
  { value: "stock", label: "Shares" },
  { value: "call", label: "Long Call" },
  { value: "put", label: "Long Put" },
  { value: "call_spread", label: "Call Spread" },
  { value: "put_spread", label: "Put Spread" },
  { value: "other", label: "Other" },
] as const;

export const DIRECTIONS = [
  { value: "long", label: "Long / Bullish" },
  { value: "short", label: "Short / Bearish" },
] as const;

export const EMOTIONS_BEFORE = [
  { value: "calm", label: "Calm" },
  { value: "confident", label: "Confident" },
  { value: "anxious", label: "Anxious" },
  { value: "fomo", label: "FOMO" },
  { value: "revenge", label: "Revenge" },
  { value: "greedy", label: "Greedy" },
  { value: "fearful", label: "Fearful" },
  { value: "bored", label: "Bored" },
] as const;

export const EMOTIONS_AFTER = [
  { value: "calm", label: "Calm" },
  { value: "relieved", label: "Relieved" },
  { value: "euphoric", label: "Euphoric" },
  { value: "frustrated", label: "Frustrated" },
  { value: "regretful", label: "Regretful" },
  { value: "disappointed", label: "Disappointed" },
  { value: "vindicated", label: "Vindicated" },
  { value: "fearful", label: "Fearful / scared" },
  { value: "numb", label: "Numb" },
] as const;

export const OUTCOMES = [
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "scratch", label: "Scratch" },
] as const;

export const SETUP_TYPES = [
  { value: "initial_breakout", label: "Initial breakout" },
  { value: "break_retest_break", label: "Break, retest, break" },
  { value: "break_retest_hod", label: "Break, retest, high of breakout" },
  { value: "undercut_reclaim", label: "Undercut & reclaim" },
  { value: "earnings", label: "Earnings play" },
  { value: "news", label: "News / catalyst play" },
  { value: "roll", label: "Roll (from prior position)" },
  { value: "bottom_rr", label: "Stock bottomed, good R/R" },
  { value: "dip_buy", label: "Dip buy" },
  { value: "other", label: "Other" },
] as const;

export const EXIT_STRATEGIES = [
  { value: "hit_target", label: "Hit target" },
  { value: "trimmed_strength", label: "Trimmed into strength" },
  { value: "stopped_out", label: "Stopped out" },
  { value: "time_exit", label: "Time exit (no move)" },
  { value: "panic_exit", label: "Panic exit" },
  { value: "other", label: "Other" },
] as const;

export const SETUP_WORKED = [
  { value: "yes", label: "Yes — played out as expected" },
  { value: "partial", label: "Partially — moved my way but stalled" },
  { value: "no", label: "No — never worked" },
] as const;

// Sizing dropdown — $500 increments from $500 to Tier 3 max ($8,000).
// Keeps every trade within the risk-managed tier structure.
export const SIZING_TIERS = [
  { value: 500, label: "$500", tier: "Tier 0 · Lotto" },
  { value: 1000, label: "$1,000", tier: "Tier 0 · Lotto" },
  { value: 1500, label: "$1,500", tier: "—" },
  { value: 2000, label: "$2,000", tier: "Tier 1" },
  { value: 2500, label: "$2,500", tier: "Tier 1" },
  { value: 3000, label: "$3,000", tier: "Tier 1" },
  { value: 3500, label: "$3,500", tier: "—" },
  { value: 4000, label: "$4,000", tier: "Tier 2" },
  { value: 4500, label: "$4,500", tier: "Tier 2" },
  { value: 5000, label: "$5,000", tier: "Tier 2" },
  { value: 5500, label: "$5,500", tier: "—" },
  { value: 6000, label: "$6,000", tier: "Tier 3" },
  { value: 6500, label: "$6,500", tier: "Tier 3" },
  { value: 7000, label: "$7,000", tier: "Tier 3" },
  { value: 7500, label: "$7,500", tier: "Tier 3" },
  { value: 8000, label: "$8,000", tier: "Tier 3 · max" },
] as const;

export const KEY_LEVEL_LABELS = [
  { value: "support", label: "Support" },
  { value: "resistance", label: "Resistance" },
] as const;

// Broader indices behavior tag — used on macro events to capture how
// SPX / QQQ were acting around the print, independent of a single trade.
export const INDICES_BEHAVIOR = [
  { value: "ripping", label: "Ripping (strong rally)" },
  { value: "grinding_up", label: "Grinding higher" },
  { value: "sideways", label: "Sideways / chop" },
  { value: "choppy", label: "Choppy / volatile" },
  { value: "grinding_down", label: "Grinding lower" },
  { value: "dumping", label: "Dumping (sharp sell-off)" },
] as const;

export const MARKET_REGIMES = [
  { value: "cooperating", label: "Cooperating — SPX/QQQ going my way" },
  { value: "sideways", label: "Sideways — chop, no directional bias" },
  { value: "dumping", label: "Dumping — SPX/QQQ against my trade" },
  { value: "mixed", label: "Mixed — SPX vs QQQ diverging" },
] as const;
