"use client";

import { useRouter } from "next/navigation";
import { PhotoModal, PosterModal } from "./Modals";

// Wraps the existing PhotoModal / PosterModal so the /personal/gallery/[slug]
// routes can mount a gallery picture directly. SlugLandingChoreography injects
// onClose (local unmount + clean URL via replaceState); without it (intercepting
// route or a direct mount) we fall back to smart same-origin back / external
// replace — mirrors WritingReader.jsx.
export default function GalleryReader({ item, onClose }) {
  const router = useRouter();
  if (!item) return null;

  const handleClose = onClose ?? (() => {
    const ref = typeof document !== "undefined" ? document.referrer : "";
    const sameOrigin = ref && ref.startsWith(window.location.origin);
    if (sameOrigin) {
      router.back();
    } else {
      router.replace("/personal#gallery", { scroll: false });
    }
  });

  return item.type === "poster" ? (
    <PosterModal item={item} onClose={handleClose} />
  ) : (
    <PhotoModal item={item} onClose={handleClose} />
  );
}
