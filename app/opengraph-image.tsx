import { ImageResponse } from "next/og";

// Route segment config — statically generated at build time.
export const alt = "SunPath Solar — meet Sunny, your AI solar guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social share card. Generated with next/og (satori), so it sticks to the
 * flexbox + inline-style subset satori supports — no CSS variables, grid, or
 * background-clip:text. Palette mirrors the app's "Twilight Energy" theme.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px 84px",
          backgroundColor: "#07080c",
          color: "#f3ede2",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Sunrise glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 82% -8%, rgba(255,178,62,0.38), rgba(7,8,12,0) 58%)",
          }}
        />
        {/* Sun emblem */}
        <div
          style={{
            position: "absolute",
            top: -70,
            right: 64,
            width: 280,
            height: 280,
            borderRadius: 9999,
            display: "flex",
            backgroundImage: "radial-gradient(circle at 32% 30%, #ffce5a, #ff6a3d)",
            boxShadow: "0 0 140px 50px rgba(255,106,61,0.40)",
          }}
        />

        {/* Kicker */}
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 22px",
              borderRadius: 9999,
              border: "1px solid rgba(255,178,62,0.35)",
              backgroundColor: "rgba(255,178,62,0.08)",
              color: "#ffb23e",
              fontSize: 24,
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            AGENTIC AI · SOLAR SALES REP
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 600, letterSpacing: -2 }}>
            SunPath Solar
          </div>
          <div style={{ display: "flex", fontSize: 50, fontWeight: 500, color: "#ffce5a" }}>
            Meet Sunny, your AI solar guide.
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            lineHeight: 1.4,
            color: "#9097a6",
            maxWidth: 880,
          }}
        >
          Qualifies your home, sizes a system, handles objections, and books a
          survey — in one conversation, grounded in real solar economics.
        </div>
      </div>
    ),
    { ...size },
  );
}
