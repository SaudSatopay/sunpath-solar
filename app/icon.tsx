import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser-tab icon: the SunPath sun — same radial disc as the in-app SunMark. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            display: "flex",
            backgroundImage: "radial-gradient(circle at 35% 30%, #ffce5a, #ff6a3d)",
            boxShadow: "0 0 6px rgba(255,140,60,0.9)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
