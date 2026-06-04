"use client";

import { useRouter } from "next/navigation";

// Client wrapper around router.back(). Used on standalone pages (e.g.
// /copyright) where we want to return to wherever the user came from
// instead of always sending them to "/". Falls back to "/" if there's
// no history (direct URL visit).
export default function BackButton({ className, children = "← Back" }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
