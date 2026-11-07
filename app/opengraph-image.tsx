import { ImageResponse } from "next/og";

export const alt =
  "Intrinsic: the Valuator estimates what a stock is worth, the Screener finds stocks from plain English.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          padding: "72px 80px",
          background: "#EDE8DF",
          color: "#2a2622",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: "#2a2622",
              color: "#FAF8F4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontFamily: "serif",
            }}
          >
            I
          </div>
          <div style={{ fontSize: 40, fontWeight: 600 }}>Intrinsic</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            Know what a stock is really worth.
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
            {["Intrinsic Valuator", "Intrinsic Screener"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "12px 24px",
                  borderRadius: 999,
                  background: "#FAF8F4",
                  border: "2px solid rgba(166,148,134,0.35)",
                  fontSize: 28,
                  color: "#6b5a4e",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
