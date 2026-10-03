import { ImageResponse } from "next/og";
import { fetchCustomUIScreenImage } from "@/lib/og-image";

export const runtime = "edge";

export const alt = "Codewords Custom UI";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const customImage = await fetchCustomUIScreenImage();
  if (customImage) return customImage;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#000000",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Asterisk SVG */}
        <svg
          width="200"
          height="180"
          viewBox="0 0 1080 970.74"
          style={{ marginBottom: 40 }}
        >
          <path
            fill="#ffffff"
            d="m936.83,393.55c-116.37,28.04-242.17,62.27-358.26,68.88,63.92-96.93,157.06-188.11,239.37-274.7,39.32-41.36,83.39-117.17-8.64-170.3-90.03-51.98-134.34,23.69-150.5,78.42-33.75,114.3-66.87,239.75-118.8,343.33-51.74-103.29-85.07-229.07-118.81-343.33-16.16-54.73-61.48-129.83-150.5-78.43-92.03,53.13-46.95,128.37-7.63,169.73,82.28,86.56,174.8,178.56,238.4,275.27-115.74-6.62-241.95-40.83-358.28-68.87C87.69,380.18,0,381.88,0,484.68c0,106.27,87.69,104.84,143.17,91.48,116.1-27.98,242.04-62.11,357.59-68.83-63.61,96.92-156.34,189.12-238.78,275.85-39.32,41.36-81.7,118.15,7.33,169.55,92.03,53.13,134.64-23.52,150.81-78.25,33.97-115.04,67.52-241.78,119.87-345.47,52.39,104.08,84.91,230.95,118.9,346.04,16.16,54.73,59.78,130.81,151.81,77.67,90.03-51.98,46.65-128.19,7.33-169.55-82.47-86.76-175.01-178.59-238.78-275.82,115.91,6.89,241.43,41.97,357.58,69.95,55.48,13.37,143.17,13.64,143.17-92.63,0-103.96-87.69-104.5-143.17-91.13Z"
          />
        </svg>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            CodeWords
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: "#a1a1aa",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Custom UI
          </div>
        </div>

      </div>
    ),
    {
      ...size,
    }
  );
}
