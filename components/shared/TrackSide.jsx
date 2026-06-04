"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics";

// Fires a single `side_viewed` event when a landing mounts. Dropped into the
// (server-component) personal + pro landings so we can see the personal↔pro
// split. `side` is "personal" | "professional".
export default function TrackSide({ side }) {
  useEffect(() => {
    analytics.sideViewed(side);
  }, [side]);
  return null;
}
