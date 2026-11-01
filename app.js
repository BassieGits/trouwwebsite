import { CONTENT } from './content.js';
import { getInvitation, getRsvp, saveRsvp } from './api.js';
import { buildEnvelope } from './envelope.js';

const OPTIONS = {
  dag: [
    ['beide', 'Dag & avond'],
    ['dag', 'Alleen overdag'],
    ['avond', 'Alleen avond'],
    ['nee', 'Helaas niet'],
  ],
  avond: [
    ['avond', 'Ik ben erbij'],
    ['nee', 'Helaas niet'],
  ],
};

const SUMMARY_LABELS = { beide: 'Dag & avond', dag: 'Overdag', avond: 'Avond', nee: 'Kan helaas niet' };

// Lijniconen voor het programma (24×24, lijndikte via CSS-kleur).
const ICONS = {
  glasses:
    '<path d="M7 3h4l-.5 6a2.5 2.5 0 0 1-3 0L7 3zM9 10v8M7 18h4M13 3h4l-.5 6a2.5 2.5 0 0 1-3 0L13 3zM15 10v8M13 18h4"/>',
  rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10.5 5.5 12 4l1.5 1.5L12 8z"/>',
  cake: '<path d="M5 20h14M6 20v-6h12v6M8 14v-4h8v4M12 10V7M12 7c-.8-.7-.8-1.8 0-3 .8 1.2.8 2.3 0 3z"/>',
  dinner: '<circle cx="12" cy="13" r="5.5"/><path d="M4 4v5a1.5 1.5 0 0 0 1.5 1.5V20M5.5 4v4M20 4c-1.5 1-2 3-2 6h2v10"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  moon: '<path d="M19 15.5A7.5 7.5 0 1 1 10.5 5a6 6 0 0 0 8.5 10.5z"/>',
};

const $ = (selector, root = document) => root.querySelector(selector);

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function joinNames(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0];
}

// Vervangt {jij}, {wilt}, {mag} en {bent} door enkelvoud of meervoud.
function personalize(text, plural) {
  const words = plural
    ? { jij: 'jullie', wilt: 'willen', mag: 'mogen', bent: 'zijn' }
    : { jij: 'jij', wilt: 'wilt', mag: 'mag', bent: 'bent' };
  return text.replace(/\{(\w+)\}/g, (match, key) => words[key] ?? match);
}

/* ---------- Start ---------- */

async function init() {
  const params = new URLSearchParams(location.search);
  const code = params.get('c') || params.get('code');
  let invitation = null;
  let loadFailed = false;
  try {
    invitation = code ? await getInvitation(code) : null;
  } catch {
    loadFailed = true;
  }

  setupEnvelope(invitation);

  if (invitation) {
    showInvitation(invitation);
  } else {
    showCodeForm(
      loadFailed
        ? 'De uitnodiging kon even niet geladen worden. Probeer het later opnieuw.'
        : code
          ? 'Deze code kennen we helaas niet. Controleer de link in je bericht.'
          : '',
    );
  }
}

// Het envelop opent eenmalig per bezoek; daarna gaan gasten direct naar de uitnodiging.
async function setupEnvelope(invitation) {
  const envelope = $('#envelope');
  const remove = () => {
    envelope.remove();
    document.body.classList.remove('is-sealed');
  };

  let opened = false;
  try {
    opened = sessionStorage.getItem('envelope-opened') === '1';
  } catch {}
  if (opened) return remove();

  if (invitation) {
    $('#envelope-name').textContent = `voor ${invitation.greeting ?? joinNames(invitation.guests)}`;
  }

  let light;
  try {
    light = await buildEnvelope($('#env-stage'), 'assets/envelop-strand.png', 'assets/namen.png');
  } catch {
    return remove();
  }

  const music = prepareMusic('assets/riff.m4a');

  const open = () => {
    music.play();
    // zonlicht over folie en zegel → zegel breekt → kleppen open → zee met namen → namen vliegen naar de site
    const step = (className, ms) => setTimeout(() => envelope.classList.add(className), ms);
    envelope.classList.add('lit');
    light.start();
    try {
      sessionStorage.setItem('envelope-opened', '1');
    } catch {}
    step('crack', 1450);
    step('open', 1800);
    step('names', 3100);
    setTimeout(flyNames, 3900);
    step('zoom', 3900);
    step('fade', 4100);
    setTimeout(() => document.body.classList.remove('is-sealed'), 4300);
    setTimeout(() => {
      light.stop();
      remove();
    }, 5500);
  };

  // De namen op de zonsondergang schuiven naar hun plek bovenaan de site en kleuren mee van wit naar inkt.
  const flyNames = () => {
    const from = $('.env-inside-text .lettering');
    const to = $('.hero-names');
    document.body.classList.add('names-handoff');
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const flight = document.createElement('span');
    flight.className = 'lettering names-flight';
    flight.setAttribute('aria-hidden', 'true');
    Object.assign(flight.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px` });
    document.body.append(flight);
    from.style.visibility = 'hidden';
    flight.getBoundingClientRect();
    flight.classList.add('land');
    Object.assign(flight.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px` });
    setTimeout(() => {
      document.body.classList.remove('names-handoff');
      flight.remove();
    }, 1650);
  };
  // ?envstate=lit,crack,open&envt=1.2 zet de envelop stil in die stand (om te testen en te vergelijken).
  const params = new URLSearchParams(location.search);
  const preview = params.get('envstate');
  if (preview) {
    envelope.classList.add('no-anim', ...preview.split(','));
    if (preview.includes('lit')) light.render(Number(params.get('envt') ?? 1.2));
  }

  $('#seal').addEventListener('click', open, { once: true });
  envelope.addEventListener('click', (event) => {
    if (event.target !== $('#seal') && !envelope.classList.contains('lit')) $('#seal').click();
  });
}

// Het riffje uit het begin van onze openingsdans: heel zacht bij het openen, daarna langzaam weg.
// Via Web Audio, omdat iPhones het volume van een gewoon <audio>-element negeren.
function prepareMusic(src) {
  const data = fetch(src)
    .then((response) => response.arrayBuffer())
    .catch(() => null);
  return {
    async play() {
      try {
        // de context moet direct bij de tik ontstaan, anders blijft hij op iPhones stil
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        ctx.resume();
        const bytes = await data;
        if (!bytes) return;
        const buffer = await ctx.decodeAudioData(bytes.slice(0));
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        const volume = 0.22;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 1.5);
        gain.gain.setValueAtTime(volume, now + 11);
        gain.gain.linearRampToValueAtTime(0, now + buffer.duration);
        source.buffer = buffer;
        source.connect(gain).connect(ctx.destination);
        source.start(now);
        source.onended = () => ctx.close();
      } catch {
        // geen geluid is geen probleem; de opening werkt gewoon door
      }
    },
  };
}

function showCodeForm(error) {
  const form = $('#code-form');
  form.hidden = false;
  $('#code-error').textContent = error;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = $('#code-input').value.trim();
    const invitation = await getInvitation(code).catch(() => null);
    if (!invitation) {
      $('#code-error').textContent = 'Deze code kennen we helaas niet. Controleer je uitnodiging.';
      return;
    }
    history.replaceState(null, '', `?c=${encodeURIComponent(invitation.code)}`);
    form.hidden = true;
    showInvitation(invitation);
  });
}

async function showInvitation(invitation) {
  const plural = invitation.guests.length > 1;
  const isDay = invitation.type === 'dag';
  const eveningStart = CONTENT.program.find((item) => !item.dagOnly).time;

  $('#greeting').textContent = `Lieve ${invitation.greeting ?? joinNames(invitation.guests)}`;
  if (!isDay) {
    $('.hero-lead').textContent = 'Wij gaan trouwen en geven een feest';
    $('#hero-place').textContent = `Strandclub Witsand · vanaf ${eveningStart}`;
  }
  $('#scroll-cue').hidden = false;

  const main = $('#invitation');
  main.innerHTML = renderSections(invitation, plural);
  main.hidden = false;

  startCountdown();
  setupReveal();
  setupFloatingRsvp();

  const rsvp = await getRsvp(invitation.code);
  if (rsvp) {
    renderConfirmation(invitation, rsvp);
  } else {
    renderForm(invitation);
  }
}

/* ---------- Secties ---------- */

function photoHtml(src, className, emptyLabel, focus) {
  if (!src && !CONTENT.showPhotoPlaceholders) return '';
  const style = focus ? ` style="object-position:${focus.position};transform-origin:${focus.position};transform:scale(${focus.zoom ?? 1})"` : '';
  return `
    <figure class="photo ${className} reveal">
      ${src ? `<img src="${src}" alt="Maaike en Bas" loading="lazy"${style}>` : `<figcaption class="photo-empty">${emptyLabel}</figcaption>`}
    </figure>`;
}

// Gestileerde zon: een cirkel met fijne stralen eromheen, met de foto in het midden.
function sunPhotoHtml(src, focus) {
  const rays = Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    const outer = i % 2 ? 86 : 95;
    const p = (r) => `${(Math.cos(angle) * r).toFixed(2)} ${(Math.sin(angle) * r).toFixed(2)}`;
    return `M${p(77)}L${p(outer)}`;
  }).join('');
  return `
    <div class="photo-sun reveal">
      <svg class="sun-rays" viewBox="-100 -100 200 200" aria-hidden="true">
        <circle r="72" fill="none" />
        <path d="${rays}" />
      </svg>
      ${photoHtml(src, 'photo-sun-disc', 'Foto<br>jullie samen', focus)}
    </div>`;
}

function renderSections(invitation, plural) {
  const isDay = invitation.type === 'dag';
  const program = CONTENT.program.filter((item) => isDay || !item.dagOnly);
  const { venue, dresscode } = CONTENT;

  return `
    <section class="section" id="aftellen">
      <div class="section-inner reveal">
        <p class="eyebrow">Nog even geduld</p>
        <div class="countdown" id="countdown">
          <div><strong data-unit="days">0</strong><span>Dagen</span></div>
          <div><strong data-unit="hours">0</strong><span>Uur</span></div>
          <div><strong data-unit="minutes">0</strong><span>Minuten</span></div>
          <div><strong data-unit="seconds">0</strong><span>Seconden</span></div>
        </div>
      </div>
    </section>

    <section class="section" id="uitnodiging">
      <div class="section-inner">
        <div class="reveal">
          <p class="eyebrow">${isDay ? 'Uitnodiging' : 'Uitnodiging avondfeest'}</p>
          <h2 class="title">Wij zeggen <em>ja</em></h2>
          <p class="lead">${escapeHtml(personalize(CONTENT.intro[invitation.type], plural))}</p>
        </div>
        ${sunPhotoHtml(CONTENT.photos.portrait, CONTENT.photos.portraitFocus)}
      </div>
    </section>

    <section class="section section-tint" id="programma">
      <div class="section-inner section-wide">
        <div class="reveal">
          <p class="eyebrow">Programma</p>
          <h2 class="title">${isDay ? 'De dag' : 'De avond'}</h2>
        </div>
        <ol class="timeline">
          ${program
            .map(
              (item) => `
            <li class="reveal${item.photo ? ' has-photo' : ''}">
              ${item.photo ? `<figure class="timeline-photo"><img src="${item.photo}" alt="" loading="lazy"></figure>` : ''}
              <div class="timeline-text">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[item.icon] ?? ''}</svg>
                <time>${item.time}</time>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.text)}</p>
              </div>
            </li>`,
            )
            .join('')}
        </ol>
      </div>
    </section>

    <section class="section" id="locatie">
      <div class="section-inner reveal">
        <p class="eyebrow">Locatie</p>
        <h2 class="venue-name">${escapeHtml(venue.name)}</h2>
        <address class="venue-address">${venue.address.map(escapeHtml).join('<br>')}</address>
        <svg class="horizon" viewBox="0 0 300 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <path d="M120 30a30 30 0 0 1 60 0" /><path d="M0 30h300" /><path d="M60 36h180" opacity=".6" />
        </svg>
        <a class="button button-ghost" href="${venue.mapsUrl}" target="_blank" rel="noopener">Route plannen</a>
      </div>
    </section>

    <section class="section section-tint" id="dresscode">
      <div class="section-inner reveal">
        <p class="eyebrow">Dresscode</p>
        <h2 class="title"><em>${escapeHtml(dresscode.title)}</em></h2>
        <p class="lead">${escapeHtml(dresscode.text)}</p>
        <div class="swatches">
          ${dresscode.colors.map((color) => `<span class="swatch"><i style="background:${color.hex}"></i>${escapeHtml(color.name)}</span>`).join('')}
        </div>
      </div>
    </section>

    ${photoHtml(CONTENT.photos.landscape, 'photo-wide', 'Foto<br>jullie op het strand')}

    ${renderMoments()}

    <section class="section" id="info">
      <div class="section-inner reveal">
        <p class="eyebrow">Goed om te weten</p>
        <h2 class="title">Vragen</h2>
        <div class="faq">
          ${CONTENT.faq
            .map(
              (item) => `
            <details>
              <summary>${escapeHtml(item.q)}</summary>
              <p>${escapeHtml(item.a)}</p>
            </details>`,
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section section-tint" id="rsvp">
      <div class="section-inner reveal">
        <p class="eyebrow">RSVP</p>
        <h2 class="title">${plural ? 'Zijn jullie erbij?' : 'Ben je erbij?'}</h2>
        <p class="lead">Laat het ons uiterlijk ${CONTENT.rsvpDeadline} weten.</p>
      </div>
      <div class="rsvp-card" id="rsvp-card"></div>
    </section>

    <footer class="footer">
      <p class="lettering" role="img" aria-label="${escapeHtml(CONTENT.couple)}"></p>
      <p class="eyebrow">25 · 06 · 2027</p>
    </footer>`;
}

function renderMoments() {
  const { moments } = CONTENT;
  if (!moments?.items.length) return '';
  return `
    <section class="section section-tint" id="momenten">
      <div class="section-inner reveal">
        <p class="eyebrow">Wij samen</p>
        <h2 class="title">${escapeHtml(moments.title)}</h2>
        <p class="lead">${escapeHtml(moments.intro)}</p>
      </div>
      <ul class="polaroids">
        ${moments.items
          .map(
            (item) => `
          <li class="polaroid">
            <figure>
              <span class="polaroid-photo"><img src="${item.src}" alt="${escapeHtml(item.caption)}" loading="lazy" style="object-position:${item.position ?? '50% 50%'}${item.zoom ? `;transform:scale(${item.zoom})` : ''}"></span>
              <figcaption>${escapeHtml(item.caption)}</figcaption>
            </figure>
          </li>`,
          )
          .join('')}
      </ul>
    </section>`;
}

function startCountdown() {
  const wedding = new Date(`${CONTENT.date}T${CONTENT.program[0].time}:00${CONTENT.utcOffset}`);
  const cells = Object.fromEntries([...document.querySelectorAll('[data-unit]')].map((el) => [el.dataset.unit, el]));

  const tick = () => {
    const left = Math.max(0, wedding - Date.now());
    const values = {
      days: Math.floor(left / 86_400_000),
      hours: Math.floor(left / 3_600_000) % 24,
      minutes: Math.floor(left / 60_000) % 60,
      seconds: Math.floor(left / 1000) % 60,
    };
    for (const [unit, value] of Object.entries(values)) {
      cells[unit].textContent = unit === 'days' ? value : String(value).padStart(2, '0');
    }
  };
  tick();
  setInterval(tick, 1000);
}

function setupReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// De RSVP-knop zweeft in beeld zodra de gast voorbij de opening scrolt, behalve bij het formulier zelf.
function setupFloatingRsvp() {
  const button = $('#rsvp-float');
  button.hidden = false;
  const state = { pastHero: false, atRsvp: false };
  const update = () => button.classList.toggle('visible', state.pastHero && !state.atRsvp);

  new IntersectionObserver(([entry]) => {
    state.pastHero = !entry.isIntersecting;
    update();
  }).observe($('.hero'));

  new IntersectionObserver(
    ([entry]) => {
      state.atRsvp = entry.isIntersecting;
      update();
    },
    { threshold: 0.05 },
  ).observe($('#rsvp'));
}

/* ---------- RSVP-formulier ---------- */

function choicesHtml(name, type, selected) {
  return `
    <div class="choices" role="radiogroup">
      ${OPTIONS[type]
        .map(
          ([value, label]) => `
        <label class="choice">
          <input type="radio" name="${name}" value="${value}" ${selected === value ? 'checked' : ''}>
          <span>${label}</span>
        </label>`,
        )
        .join('')}
    </div>`;
}

function renderForm(invitation, previous) {
  const card = $('#rsvp-card');
  const plusOne = previous?.plusOne;

  card.innerHTML = `
    <form id="rsvp-form" novalidate>
      ${invitation.guests
        .map((name, i) => {
          const answer = previous?.guests[i];
          return `
          <fieldset class="guest" data-guest="${i}">
            <legend>${escapeHtml(name)}</legend>
            ${choicesHtml(`att-${i}`, invitation.type, answer?.attendance)}
            <div class="field diet" ${!answer || answer.attendance === 'nee' ? 'hidden' : ''}>
              <label for="diet-${i}">Dieetwensen of allergieën <span class="hint">(optioneel)</span></label>
              <input id="diet-${i}" name="diet-${i}" value="${escapeHtml(answer?.diet)}">
            </div>
          </fieldset>`;
        })
        .join('')}

      ${
        invitation.plusOne
          ? `
        <fieldset class="guest" data-plus-one>
          <legend>Introducé</legend>
          <p class="plus-one-question">Neem je iemand mee?</p>
          <div class="choices" role="radiogroup">
            <label class="choice"><input type="radio" name="plus" value="ja" ${plusOne ? 'checked' : ''}><span>Ja, graag</span></label>
            <label class="choice"><input type="radio" name="plus" value="nee" ${previous && !plusOne ? 'checked' : ''}><span>Nee</span></label>
          </div>
          <div class="plus-one-details" ${plusOne ? '' : 'hidden'}>
            <div class="field">
              <label for="plus-name">Naam introducé</label>
              <input id="plus-name" name="plus-name" autocomplete="off" value="${escapeHtml(plusOne?.name)}">
            </div>
            ${
              invitation.type === 'dag'
                ? `<div class="field"><label>Aanwezig</label>${choicesHtml('att-plus', 'dag', plusOne?.attendance)}</div>`
                : ''
            }
            <div class="field">
              <label for="plus-diet">Dieetwensen of allergieën <span class="hint">(optioneel)</span></label>
              <input id="plus-diet" name="plus-diet" value="${escapeHtml(plusOne?.diet)}">
            </div>
          </div>
        </fieldset>`
          : ''
      }

      <div class="field">
        <label for="song">Welk nummer mag de DJ niet vergeten? <span class="hint">(optioneel)</span></label>
        <input id="song" name="song" value="${escapeHtml(previous?.song)}">
      </div>
      <div class="field">
        <label for="message">Nog iets dat we moeten weten? <span class="hint">(optioneel)</span></label>
        <textarea id="message" name="message">${escapeHtml(previous?.message)}</textarea>
      </div>

      <p class="form-error" id="form-error" role="alert"></p>
      <button class="button" type="submit">Verstuur antwoord</button>
    </form>`;

  const form = $('#rsvp-form');

  // Dieetveld alleen tonen bij iemand die komt; introducé-velden alleen bij "ja".
  form.addEventListener('change', (event) => {
    const { name, value } = event.target;
    if (name?.startsWith('att-') && name !== 'att-plus') {
      event.target.closest('.guest').querySelector('.diet').hidden = value === 'nee';
    }
    if (name === 'plus') {
      $('.plus-one-details', form).hidden = value !== 'ja';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = readForm(form, invitation);
    if (result.error) {
      $('#form-error').textContent = result.error;
      return;
    }
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    button.textContent = 'Versturen…';
    try {
      const saved = await saveRsvp(invitation.code, result.rsvp);
      renderConfirmation(invitation, saved);
      $('#rsvp').scrollIntoView();
    } catch {
      $('#form-error').textContent = 'Er ging iets mis bij het versturen. Probeer het nog eens.';
      button.disabled = false;
      button.textContent = 'Verstuur antwoord';
    }
  });
}

function readForm(form, invitation) {
  const data = new FormData(form);
  const guests = invitation.guests.map((name, i) => ({
    name,
    attendance: data.get(`att-${i}`),
    diet: data.get(`diet-${i}`)?.trim() ?? '',
  }));

  const missing = guests.find((guest) => !guest.attendance);
  if (missing) return { error: `Laat je nog weten of ${missing.name} erbij is?` };

  let plusOne = null;
  if (invitation.plusOne) {
    const answer = data.get('plus');
    if (!answer) return { error: 'Laat je nog weten of je een introducé meeneemt?' };
    if (answer === 'ja') {
      plusOne = {
        name: data.get('plus-name').trim(),
        attendance: invitation.type === 'dag' ? data.get('att-plus') : 'avond',
        diet: data.get('plus-diet').trim(),
      };
      if (!plusOne.name) return { error: 'Wat is de naam van je introducé?' };
      if (!plusOne.attendance) return { error: 'Laat je nog weten wanneer je introducé erbij is?' };
    }
  }

  return {
    rsvp: {
      guests,
      plusOne,
      song: data.get('song').trim(),
      message: data.get('message').trim(),
    },
  };
}

/* ---------- Bevestiging ---------- */

function renderConfirmation(invitation, rsvp) {
  const people = [...rsvp.guests, ...(rsvp.plusOne ? [rsvp.plusOne] : [])];
  const attending = people.filter((person) => person.attendance !== 'nee');
  const plural = invitation.guests.length > 1;

  const title = attending.length ? 'Dank je wel' : 'Wat jammer';
  const text = attending.length
    ? `Wat fijn dat ${plural ? 'jullie' : 'je'} erbij ${plural ? 'zijn' : 'bent'}. We kijken ernaar uit!`
    : `Jammer dat ${plural ? 'jullie' : 'je'} er niet bij ${plural ? 'kunnen' : 'kunt'} zijn. Bedankt voor het laten weten.`;

  $('#rsvp-card').innerHTML = `
    <div class="confirmation">
      <h3>${title}</h3>
      <p>${text}</p>
      <ul class="summary">
        ${people
          .map(
            (person) => `
          <li>
            <span>${escapeHtml(person.name)}</span>
            <span>${SUMMARY_LABELS[person.attendance]}</span>
          </li>`,
          )
          .join('')}
      </ul>
      <div class="confirmation-actions">
        ${attending.length ? '<button class="button" type="button" id="add-calendar">Zet in je agenda</button>' : ''}
        <button class="button button-ghost" type="button" id="edit-rsvp">Antwoord wijzigen</button>
      </div>
    </div>`;

  $('#edit-rsvp').addEventListener('click', () => renderForm(invitation, rsvp));
  $('#add-calendar')?.addEventListener('click', () => downloadCalendar(attending));
}

/* ---------- Agenda (.ics) ---------- */

function downloadCalendar(attending) {
  const comesDuringDay = attending.some((person) => ['beide', 'dag'].includes(person.attendance));
  const comesEvening = attending.some((person) => ['beide', 'avond'].includes(person.attendance));
  const dayItems = CONTENT.program.filter((item) => item.dagOnly);
  const eveningItems = CONTENT.program.filter((item) => !item.dagOnly);

  const start = comesDuringDay ? dayItems[0].time : eveningItems[0].time;
  const end = comesEvening ? eveningItems.at(-1).time : eveningItems[0].time;

  const icsDate = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const toUtc = (time, nextDay = false) => {
    const date = new Date(`${CONTENT.date}T${time}:00${CONTENT.utcOffset}`);
    if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
    return icsDate(date);
  };

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maaike en Bas//Bruiloft//NL',
    'BEGIN:VEVENT',
    `UID:bruiloft-${CONTENT.date}@maaike-en-bas`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${toUtc(start)}`,
    `DTEND:${toUtc(end, end < start)}`,
    `SUMMARY:Bruiloft ${CONTENT.couple}`,
    `LOCATION:${CONTENT.venue.name}\\, ${CONTENT.venue.address.join('\\, ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  link.download = 'bruiloft-maaike-en-bas.ics';
  link.click();
  URL.revokeObjectURL(link.href);
}

init();
