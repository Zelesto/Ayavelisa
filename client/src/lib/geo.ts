
import type { GpsCapture } from "./types";

const unavailableGps = (): GpsCapture => ({
  lat: 0,
  lng: 0,
  accuracyM: 0,
  capturedAt: new Date().toISOString(),
  source: "unavailable",
});

export function captureGps(): Promise<GpsCapture> {
  return new Promise((resolve) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      resolve(unavailableGps());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracyM: Math.round(pos.coords.accuracy),
          capturedAt: new Date().toISOString(),
          source: "device",
        });
      },
      () => {
        resolve(unavailableGps());
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 15000,
      },
    );
  });
}

export function formatCoord(g: GpsCapture | null): string {
  if (!g || g.source === "unavailable") {
    return "No GPS available";
  }

  const ns = g.lat >= 0 ? "N" : "S";
  const ew = g.lng >= 0 ? "E" : "W";

  return `${Math.abs(g.lat).toFixed(4)}° ${ns}, ${
    Math.abs(g.lng).toFixed(4)
  }° ${ew} · ±${g.accuracyM} m`;
}
