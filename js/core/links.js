// Fills [data-link="path.in.config"] anchors from config.js and wires copy buttons.
import { LINKS } from '../config.js';

const lookup = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), LINKS);

export function hydrateLinks(root = document) {
  root.querySelectorAll('[data-link]').forEach((a) => {
    const url = lookup(a.dataset.link);
    if (url) {
      a.href = url;
      a.removeAttribute('aria-disabled');
      a.classList.remove('is-pending');
      if (/^https?:/.test(url)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      a.querySelector('.pending-note')?.remove();
      const meta = a.querySelector('[data-pending-meta]');
      if (meta) meta.textContent = meta.dataset.liveText || 'Open';
    } else {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      a.classList.add('is-pending');
      if (!a.querySelector('.pending-note, [data-pending-meta]')) {
        const note = document.createElement('span');
        note.className = 'pending-note';
        note.textContent = 'coming soon';
        a.append(note);
      }
    }
  });
  root.querySelectorAll('[data-email]').forEach((el) => {
    el.textContent = LINKS.email;
  });
}

export function initCopyButtons(root = document) {
  root.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const source =
        btn.dataset.copy === 'email' ? LINKS.email : document.querySelector(btn.dataset.copy)?.textContent || '';
      const original = btn.dataset.label || btn.textContent;
      btn.dataset.label = original;
      try {
        await navigator.clipboard.writeText(source);
        btn.textContent = 'Copied';
        btn.dataset.state = 'done';
      } catch {
        // Clipboard refused: select the visible text so the viewer can copy it.
        const target = btn.closest('.copy-field, .form__result')?.querySelector('.copy-field__value, pre');
        if (target) {
          const range = document.createRange();
          range.selectNodeContents(target);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        btn.textContent = 'Selected, press Ctrl+C';
      }
      setTimeout(() => {
        btn.textContent = original;
        delete btn.dataset.state;
      }, 2200);
    });
  });
}
