"use client";

import styles from "./Postcard.module.css";

export default function Postcard({
  loc,
  storySlugs = [],
  showClose = false,
  onClose,
  rotation,
  className = "",
  style,
  onViewStory,
  buttonLabel,
}) {

  const ratioClass =
    loc.ratio === "portrait" ? styles.portrait : styles.square;

  const finalStyle = {
    ...(rotation !== undefined ? { transform: `rotate(${rotation}deg)` } : {}),
    ...style,
  };

  function handleViewStory(e) {
    e.stopPropagation();
    if (!onViewStory) return;
    const slug =
      storySlugs.length === 1 ? storySlugs[0] : loc.id;
    onViewStory(slug);
  }

  return (
    <div className={`${styles.card} ${className}`} style={finalStyle}>
      {showClose && (
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close postcard"
        >
          ✕
        </button>
      )}

      <div className={`${styles.photoWrap} ${ratioClass}`}>
        <div
          className={styles.photo}
          style={{
            background: loc.photoUrl
              ? `url(${loc.photoUrl}) center/cover, ${loc.photo || "#ddd3b8"}`
              : loc.photo,
          }}
        />
        <div className={styles.photoShine} />
        <div className={styles.photoFade} />
        <div className={styles.photoLabel}>Photo</div>
        <div className={styles.stamp}>
          <div className={styles.stampInner} />
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.city}>{loc.city}</div>
        <div className={styles.meta}>
          {loc.country} · {loc.year}
        </div>
        <div className={styles.divider} />
        <div className={styles.note}>{loc.note}</div>

        {storySlugs.length > 0 && onViewStory && (
          <button
            type="button"
            className={styles.storyBtn}
            onClick={handleViewStory}
          >
            {buttonLabel ??
              (storySlugs.length === 1 ? "View Stories" : "View All Stories")}
          </button>
        )}
      </div>
    </div>
  );
}
