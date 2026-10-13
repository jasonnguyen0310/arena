import type { Trade, TradeTrim } from "@/db/schema";
import { trimPnl, tradeCostBasis, trimCostBasis } from "./payouts";

export type Rank = {
  level: number;
  name: string;
  xpInLevel: number;
  xpForLevel: number;
  progress: number; // 0..1
};

export type Achievement = {
  id: string;
  name: string;
  hint: string;
  unlocked: boolean;
};

export type Stats = {
  totalOpen: number;
  totalClosed: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number | null;
  totalPnl: number;
  totalCostBasis: number;
  avgPnl: number | null;
  bestPnl: number | null;
  worstPnl: number | null;
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  peakWinStreak: number;
  peakLossStreak: number;
  daysJournaled: number;
  lessonsWritten: number;
  pnlByEmotion: {
    emotion: string;
    count: number;
    totalPnl: number;
    avgPnl: number;
    costBasis: number;
  }[];
  rank: Rank;
  achievements: Achievement[];
};

const RANK_TIERS: { min: number; name: string }[] = [
  { min: 0, name: "RECRUIT" },
  { min: 3, name: "SCOUT" },
  { min: 6, name: "CONTENDER" },
  { min: 11, name: "VETERAN" },
  { min: 20, name: "CHAMPION" },
  { min: 35, name: "LEGEND" },
];

function computeRank(closedCount: number): Rank {
  const level = Math.floor(closedCount / 3) + 1;
  const xpInLevel = closedCount % 3;
  const xpForLevel = 3;
  const tier = [...RANK_TIERS].reverse().find((t) => level >= t.min) ?? RANK_TIERS[0];
  return {
    level,
    name: tier.name,
    xpInLevel,
    xpForLevel,
    progress: xpInLevel / xpForLevel,
  };
}

function computePeakStreaks(closed: Trade[]): { win: number; loss: number } {
  const chrono = [...closed].sort(
    (a, b) => (a.closed_at?.getTime() ?? 0) - (b.closed_at?.getTime() ?? 0),
  );
  let peakWin = 0;
  let peakLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of chrono) {
    if (t.outcome === "win") {
      curWin++;
      curLoss = 0;
      if (curWin > peakWin) peakWin = curWin;
    } else if (t.outcome === "loss") {
      curLoss++;
      curWin = 0;
      if (curLoss > peakLoss) peakLoss = curLoss;
    }
  }
  return { win: peakWin, loss: peakLoss };
}

export function computeStats(open: Trade[], closed: Trade[], trims: TradeTrim[] = []): Stats {
  const wins = closed.filter((t) => t.outcome === "win").length;
  const losses = closed.filter((t) => t.outcome === "loss").length;
  const scratches = closed.filter((t) => t.outcome === "scratch").length;
  const decided = wins + losses;

  const closedPnls = closed.map((t) => t.pnl ?? 0);
  const tradesById = new Map([...open, ...closed].map((t) => [t.id, t]));
  // Only trims from OPEN trades count separately — closed trades already have all
  // their trim P&L baked into `trade.pnl` (that's the source of truth on close).
  const openTrimPnls: number[] = [];
  for (const tr of trims) {
    const trade = tradesById.get(tr.trade_id);
    if (!trade) continue;
    if (trade.closed_at) continue;
    const v = trimPnl(tr, trade);
    if (v == null) continue;
    openTrimPnls.push(v);
  }
  const allPnls = [...closedPnls, ...openTrimPnls];
  const totalPnl = allPnls.reduce((a, b) => a + b, 0);
  const avgPnl = closed.length > 0 ? closedPnls.reduce((a, b) => a + b, 0) / closed.length : null;
  const bestPnl = allPnls.length > 0 ? Math.max(...allPnls) : null;
  const worstPnl = allPnls.length > 0 ? Math.min(...allPnls) : null;

  const chronological = [...closed].sort(
    (a, b) => (a.closed_at?.getTime() ?? 0) - (b.closed_at?.getTime() ?? 0),
  );
  let streakType: "win" | "loss" | "none" = "none";
  let streakCount = 0;
  for (let i = chronological.length - 1; i >= 0; i--) {
    const o = chronological[i].outcome;
    if (o !== "win" && o !== "loss") continue;
    if (streakType === "none") {
      streakType = o;
      streakCount = 1;
    } else if (o === streakType) {
      streakCount++;
    } else {
      break;
    }
  }

  const peaks = computePeakStreaks(closed);

  const allDays = new Set(
    [...open, ...closed].map((t) => t.opened_at.toISOString().slice(0, 10)),
  );

  const lessonsWritten = closed.filter(
    (t) => t.lesson && t.lesson.trim().length > 0,
  ).length;

  const byEmotion = new Map<string, { count: number; totalPnl: number; costBasis: number }>();
  for (const t of closed) {
    const key = t.emotion_before;
    const cur = byEmotion.get(key) ?? { count: 0, totalPnl: 0, costBasis: 0 };
    cur.count += 1;
    cur.totalPnl += t.pnl ?? 0;
    cur.costBasis += tradeCostBasis(t) ?? 0;
    byEmotion.set(key, cur);
  }
  for (const tr of trims) {
    const trade = tradesById.get(tr.trade_id);
    if (!trade) continue;
    if (trade.closed_at) continue; // baked into trade.pnl already
    const v = trimPnl(tr, trade);
    if (v == null) continue;
    const key = trade.emotion_before;
    const cur = byEmotion.get(key) ?? { count: 0, totalPnl: 0, costBasis: 0 };
    cur.count += 1;
    cur.totalPnl += v;
    cur.costBasis += trimCostBasis(tr, trade) ?? 0;
    byEmotion.set(key, cur);
  }
  const pnlByEmotion = [...byEmotion.entries()]
    .map(([emotion, v]) => ({
      emotion,
      count: v.count,
      totalPnl: v.totalPnl,
      avgPnl: v.count ? v.totalPnl / v.count : 0,
      costBasis: v.costBasis,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);

  // Total cost basis for portfolio-level % display
  const totalCostBasis =
    closed.reduce((s, t) => s + (tradeCostBasis(t) ?? 0), 0) +
    trims.reduce((s, tr) => {
      const trade = tradesById.get(tr.trade_id);
      if (!trade) return s;
      if (trade.closed_at) return s; // baked into trade.pnl already
      return s + (trimCostBasis(tr, trade) ?? 0);
    }, 0);

  const rank = computeRank(closed.length);

  const achievements: Achievement[] = [
    {
      id: "first_blood",
      name: "FIRST BLOOD",
      hint: "Close your first trade",
      unlocked: closed.length >= 1,
    },
    {
      id: "hot_streak",
      name: "HOT STREAK",
      hint: "3 wins in a row",
      unlocked: peaks.win >= 3,
    },
    {
      id: "iron_will",
      name: "IRON WILL",
      hint: "Journal on 30 different days",
      unlocked: allDays.size >= 30,
    },
    {
      id: "high_roller",
      name: "HIGH ROLLER",
      hint: "One trade P&L ≥ $500",
      unlocked: (bestPnl ?? 0) >= 500,
    },
    {
      id: "reflected",
      name: "REFLECTED",
      hint: "10 lessons written",
      unlocked: lessonsWritten >= 10,
    },
    {
      id: "green_book",
      name: "GREEN BOOK",
      hint: "Total P&L positive over 10+ trades",
      unlocked: closed.length >= 10 && totalPnl > 0,
    },
  ];

  return {
    totalOpen: open.length,
    totalClosed: closed.length,
    wins,
    losses,
    scratches,
    winRate: decided > 0 ? wins / decided : null,
    totalPnl,
    avgPnl,
    bestPnl,
    worstPnl,
    currentStreak: { type: streakType, count: streakCount },
    peakWinStreak: peaks.win,
    peakLossStreak: peaks.loss,
    daysJournaled: allDays.size,
    lessonsWritten,
    pnlByEmotion,
    rank,
    achievements,
    totalCostBasis,
  };
}
