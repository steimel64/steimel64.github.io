// Engineering: circuit traces that wire up the Where I help cards as the
// section scrolls into view. Everything else on the page is static.
import { initTraces } from '../fx/traces.js';

export function init() {
  const traces = document.querySelector('.traces');
  if (traces) initTraces(traces);
}
