// Entry point. Shared chrome first, then the module for the current page.
import { boot } from './core/boot.js';
import { initHeader, initMenu, initHud } from './core/chrome.js';
import { initTransit } from './core/transit.js';
import { initAmbient } from './core/ambient.js';
import { initReveals, introScramble } from './core/reveal.js';
import { hydrateLinks, initCopyButtons } from './core/links.js';
import { initTickers } from './core/ticker.js';
import { scrambleOnHover } from './core/scramble.js';

const pages = {
  home: () => import('./pages/home.js'),
  engineering: () => import('./pages/engineering.js'),
  artistry: () => import('./pages/artistry.js'),
  label: () => import('./pages/label.js'),
  contact: () => import('./pages/contact.js'),
};

async function start() {
  document.documentElement.classList.add('js-ready');
  const page = document.querySelector('[data-page]')?.dataset.page;
  const booting = boot();

  hydrateLinks();
  initCopyButtons();
  initHeader();
  initMenu();
  initHud();
  initTransit();
  initAmbient();
  initTickers();
  initReveals();
  scrambleOnHover();

  // Load the page module while the boot screen runs.
  const mod = pages[page]
    ? await pages[page]().catch((err) => {
        console.error(err);
        return null;
      })
    : null;
  mod?.init?.();

  await booting;
  introScramble();
  mod?.intro?.();
}

start();
