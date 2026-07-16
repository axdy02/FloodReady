"use client";

import { useState } from "react";
import { validateDevicePosition, type LocationValue } from "@/features/map/types";

const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } as const;

export function GeolocationControl({ onLocation, onUnavailable }: { onLocation: (value: LocationValue) => void; onUnavailable: () => void }) {
  const [requesting, setRequesting] = useState(false);
  function locate() { setRequesting(true); navigator.geolocation.getCurrentPosition((position) => { setRequesting(false); const value = validateDevicePosition(position.coords.latitude, position.coords.longitude, position.coords.accuracy); if (value === null) onUnavailable(); else onLocation(value); }, () => { setRequesting(false); onUnavailable(); }, options); }
  return <button type="button" onClick={locate} disabled={requesting}>{requesting ? "Locating…" : "Use my location"}</button>;
}
