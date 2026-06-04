"use client";

import { useState } from "react";

// <img> wrapper for Notion-hosted images served via /api/notion-image. The
// proxy re-mints a fresh signed URL on every request, so expiry can no longer
// break a cover. This guards the rare residual cases (Notion down, file
// deleted): on a load error it renders `fallback` instead of a broken icon.
// Pass the gradient/placeholder you'd otherwise show when there's no image.
export default function NotionImage({ src, alt = "", fallback = null, ...rest }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...rest} />;
}
