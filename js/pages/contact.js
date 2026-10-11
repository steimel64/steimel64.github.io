// Contact: oscilloscope that reacts to typing, and a form that drafts the
// message for the visitor to copy or open in their mail app. Nothing is sent
// from the page itself, and the copy says so.
import { initScope } from '../fx/scope.js';
import { LINKS } from '../config.js';

export function init() {
  const wrap = document.querySelector('.scope');
  const scope = wrap
    ? initScope({ wrap, canvas: wrap.querySelector('canvas'), readout: wrap.querySelector('.scope__readout') })
    : { kick() {} };
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  form.addEventListener('keydown', (e) => {
    if (e.key.length === 1) scope.kick(e.key);
  });

  const result = document.querySelector('.form__result');
  const pre = result?.querySelector('pre');
  const mail = result?.querySelector('[data-mailto]');

  const fields = {
    name: form.querySelector('#name'),
    email: form.querySelector('#email'),
    topic: form.querySelector('#topic'),
    message: form.querySelector('#message'),
  };
  const error = (input, msg) => {
    const out = form.querySelector(`#${input.id}-error`);
    if (out) out.textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    if (!fields.name.value.trim()) {
      error(fields.name, 'Add your name so William knows who is writing.');
      ok = false;
    } else error(fields.name, '');
    if (!/^\S+@\S+\.\S+$/.test(fields.email.value.trim())) {
      error(fields.email, 'Enter an email address like you@studio.com.');
      ok = false;
    } else error(fields.email, '');
    if (fields.message.value.trim().length < 10) {
      error(fields.message, 'Tell me a little more, at least a sentence.');
      ok = false;
    } else error(fields.message, '');
    if (!ok) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const subject = `${fields.topic.value}: from ${fields.name.value.trim()}`;
    const body = `${fields.message.value.trim()}\n\n${fields.name.value.trim()}\n${fields.email.value.trim()}`;
    pre.textContent = `To: ${LINKS.email}\nSubject: ${subject}\n\n${body}`;
    mail.href = `mailto:${LINKS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    result.hidden = false;
    result.querySelector('h2')?.focus();
    for (let i = 0; i < 12; i++) scope.kick(String.fromCharCode(97 + i * 2));
  });
}
