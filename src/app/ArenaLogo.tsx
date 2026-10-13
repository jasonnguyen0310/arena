type Props = {
  size?: number;
  strokeWidth?: number;
  ringColor?: string;
  dotColor?: string;
  pulse?: boolean;
  className?: string;
};

export default function ArenaLogo({
  size = 24,
  strokeWidth = 1.6,
  ringColor = "currentColor",
  dotColor,
  pulse = false,
  className,
}: Props) {
  const dot = dotColor ?? ringColor;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* Arena ring — nearly-complete circle with entrance gap at the top */}
      <path
        d="M15.2 2.7 A10 10 0 1 1 8.8 2.7"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Focal dot — the trader in the arena */}
      <circle
        cx="12"
        cy="12"
        r="2.4"
        fill={dot}
        style={
          pulse
            ? { filter: `drop-shadow(0 0 6px ${dot})`, transformOrigin: "12px 12px" }
            : undefined
        }
        className={pulse ? "blink-glow" : undefined}
      />
    </svg>
  );
}
