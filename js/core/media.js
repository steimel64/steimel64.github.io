// Muted loops ([data-autoplay]) play only while on screen and never with reduced motion.
import { reducedMotion, whileVisible } from './env.js';

export function autoplayClips(root = document) {
  if (reducedMotion()) return;
  root.querySelectorAll('video[data-autoplay]').forEach((v) => {
    v.muted = true;
    whileVisible(
      v,
      (on) => {
        if (on) v.play().catch(() => {});
        else v.pause();
      },
      '0px',
    );
  });
}
