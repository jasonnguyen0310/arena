import EdgeNav from "../EdgeNav";

export default function PrinciplesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EdgeNav />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Principles</h1>
        <p className="mt-1 text-sm text-muted">
          The framework. Reread whenever the market makes you flinch.
        </p>
      </div>

      {/* 5 Fundamental Truths */}
      <div
        className="rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(147,197,253,0.06), rgba(147,197,253,0.015))",
          border: "1px solid rgba(147,197,253,0.22)",
          boxShadow: "0 0 32px -12px rgba(147,197,253,0.16)",
        }}
      >
        <div
          className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em]"
          style={{ color: "#93C5FD" }}
        >
          5 Fundamental Truths
        </div>
        <ol className="grid gap-x-8 gap-y-2 text-sm leading-snug text-text md:grid-cols-2">
          <li className="flex gap-2">
            <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>1.</span>
            <span>Anything can happen.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>2.</span>
            <span>You don&apos;t need to know what happens next to make money.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>3.</span>
            <span>Wins and losses are randomly distributed for any given edge.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>4.</span>
            <span>An edge is only a higher probability of one thing over another.</span>
          </li>
          <li className="flex gap-2 md:col-span-2">
            <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>5.</span>
            <span>Every moment in the market is unique.</span>
          </li>
        </ol>
      </div>

      {/* 7 Principles of Consistency */}
      <div
        className="rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(147,197,253,0.06), rgba(147,197,253,0.015))",
          border: "1px solid rgba(147,197,253,0.22)",
          boxShadow: "0 0 32px -12px rgba(147,197,253,0.16)",
        }}
      >
        <div
          className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em]"
          style={{ color: "#93C5FD" }}
        >
          7 Principles of Consistency
        </div>
        <p className="mb-3 text-sm italic text-muted">
          I am a consistent winner because&hellip;
        </p>
        <ol className="grid gap-x-8 gap-y-2 text-sm leading-snug text-text md:grid-cols-2">
          <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>1.</span><span>I objectively identify my edges.</span></li>
          <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>2.</span><span>I predefine the risk of every trade.</span></li>
          <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>3.</span><span>I completely accept the risk, or I am willing to let go of the trade.</span></li>
          <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>4.</span><span>I act on my edges without reservation or hesitation.</span></li>
          <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>5.</span><span>I pay myself as the market makes money available to me.</span></li>
          <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>6.</span><span>I continually monitor my susceptibility for making errors.</span></li>
          <li className="flex gap-2 md:col-span-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>7.</span><span>I understand the absolute necessity of these principles of consistent success — and therefore, I never violate them.</span></li>
        </ol>

        <div
          className="mt-5 border-t pt-4 text-center"
          style={{ borderColor: "rgba(147,197,253,0.18)" }}
        >
          <div
            className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em]"
            style={{ color: "#93C5FD" }}
          >
            Mantra
          </div>
          <p className="italic leading-relaxed text-text">
            I am a consistently profitable trader.
            <br />
            I am a consistently profitable trader.
            <br />
            I am a consistently profitable trader.
            <br />
            I am a professional risk manager.
            <br />
            I am a professional risk manager.
            <br />
            I am a professional risk manager.
          </p>
        </div>
      </div>
    </div>
  );
}
