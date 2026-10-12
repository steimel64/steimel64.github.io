// Video playback helpers.
//
// Phones can refuse to autoplay even muted video (iOS Low Power Mode, Android
// data saver). play() then rejects with NotAllowedError, so the video waits for
// the visitor's first tap or key press, which browsers accept as permission.
import { reducedMotion, whileVisible } from './env.js';

const blocked = new Set();
// The events browsers count as a user gesture for starting media.
const GESTURES = ['pointerup', 'touchend', 'keydown'];
const retry = () => {
  blocked.forEach((v) => v.play().catch(() => {}));
  blocked.clear();
};

export function playVideo(video) {
  video.play().catch((err) => {
    if (err.name !== 'NotAllowedError') return;
    if (!blocked.size)
      GESTURES.forEach((t) => window.addEventListener(t, retry, { once: true, passive: true, capture: true }));
    blocked.add(video);
  });
}

export function pauseVideo(video) {
  blocked.delete(video);
  video.pause();
}

// Muted loops ([data-autoplay]) play only while on screen and never with reduced motion.
export function autoplayClips(root = document) {
  if (reducedMotion()) return;
  root.querySelectorAll('video[data-autoplay]').forEach((v) => {
    v.muted = true;
    whileVisible(v, (on) => (on ? playVideo(v) : pauseVideo(v)), '0px');
  });
}
