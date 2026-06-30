/**
 * Fixed, non-interactive backdrop: a deep dusk sky with a warm solar glow
 * rising from the horizon, slow concentric energy rings, and a grain overlay.
 * Pure CSS/SVG — renders as a server component.
 */
export function Atmosphere() {
  return (
    <div
      aria-hidden
      className="grain pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* base vertical gradient: night at top, warmer toward the horizon */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #07080c 0%, #0a0c12 42%, #120f14 78%, #1a1212 100%)",
        }}
      />

      {/* the sun glow on the horizon */}
      <div
        className="absolute bottom-[-22vh] left-1/2 h-[70vh] w-[120vh] -translate-x-1/2 rounded-full blur-[40px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,150,60,0.55) 0%, rgba(255,106,61,0.28) 34%, rgba(255,106,61,0.06) 60%, transparent 72%)",
          animation: "sunPulse 9s ease-in-out infinite",
        }}
      />

      {/* concentric energy rings, very faint */}
      <svg
        className="absolute bottom-[-30vh] left-1/2 h-[110vh] w-[110vh]"
        style={{ animation: "ringDrift 120s linear infinite" }}
        viewBox="0 0 600 600"
        fill="none"
      >
        {[120, 200, 280, 360].map((r) => (
          <circle
            key={r}
            cx="300"
            cy="600"
            r={r}
            stroke="rgba(255,178,62,0.07)"
            strokeWidth="1"
            strokeDasharray="2 10"
          />
        ))}
      </svg>

      {/* a couple of drifting motes for depth */}
      <div
        className="absolute left-[18%] top-[24%] h-1 w-1 rounded-full bg-sun/60 blur-[1px]"
        style={{ animation: "floatY 7s ease-in-out infinite" }}
      />
      <div
        className="absolute right-[22%] top-[36%] h-1.5 w-1.5 rounded-full bg-ember/50 blur-[1px]"
        style={{ animation: "floatY 9s ease-in-out infinite 1s" }}
      />

      {/* vignette to keep focus center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, transparent 55%, rgba(4,5,8,0.6) 100%)",
        }}
      />
    </div>
  );
}
