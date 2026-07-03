// Detects Instagram's (and Facebook's) in-app WebView. Those WebViews enforce
// a strict media policy that blocks cross-origin YouTube iframe playback even
// from a real tap — the gesture lives in our page and never crosses into the
// iframe, so YouTube treats playVideo() as autoplay and refuses it. When this
// returns true the music section falls back to self-hosted native <audio>,
// which plays fine from a same-origin gesture. Normal mobile browsers
// (Safari/Chrome, including on iOS) are NOT matched and keep the YouTube path.
export function isInstagramBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FB_IAB/i.test(ua);
}
