"use client";

import { useEffect, useState } from "react";

export default function HistoryReveal() {
  const [revealed, setRevealed] = useState<boolean>(false);

  useEffect(() => {
    setRevealed(document.documentElement.classList.contains("history-revealed"));
  }, []);

  const toggle = () => {
    const next = !revealed;
    setRevealed(next);
    document.documentElement.classList.toggle("history-revealed", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="reveal-btn btn btn-ghost !py-1.5 !px-3 !text-xs"
    >
      {revealed ? "Hide history" : "Show history"}
    </button>
  );
}
