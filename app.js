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

// Een code bestaat alleen uit letters en cijfers. Zo werkt een link ook als er per ongeluk
// een punt, spatie of haakje achter is blijven hangen.
const cleanCode = (value) => (value ?? '').replace(/[^a-z0-9]/gi, '');

const LOAD_ERROR = 'De uitnodiging kon even niet geladen worden. Controleer je internetverbinding en probeer het opnieuw.';

async function init() {
  window.appStarted = true; // voor het vangnet in index.html
  $('#load-problem').hidden = true;

  const params = new URLSearchParams(location.search);
  const code = cleanCode(params.get('c') || params.get('code'));
  const loading = code ? getInvitation(code) : Promise.resolve(null);

  // De envelop wordt al opgebouwd terwijl de uitnodiging laadt; de naam komt erbij zodra die er is.
  setupEnvelope(loading.catch(() => null));

  let invitation = null;
  let loadFailed = false;
  try {
    invitation = await loading;
  } catch {
    loadFailed = true;
  }

  if (invitation) {
    showInvitation(invitation);
  } else {
    showCodeForm(
      loadFailed
        ? LOAD_ERROR
        : code
          ? 'Deze code kennen we helaas niet. Controleer de link in je bericht.'
          : '',
    );
  }
}

// Het envelop opent eenmalig per bezoek; daarna gaan gasten direct naar de uitnodiging.
async function setupEnvelope(invitationLoading) {
  const envelope = $('#envelope');
  if (!envelope) return document.body.classList.remove('is-sealed'); // het vangnet heeft hem al weggehaald
  const remove = () => {
    envelope.remove();
    document.body.classList.remove('is-sealed');
  };

  let opened = false;
  try {
    opened = sessionStorage.getItem('envelope-opened') === '1';
  } catch {}
  if (opened) return remove();

  invitationLoading.then((invitation) => {
    if (invitation) $('#envelope-name').textContent = `voor ${invitation.greeting || joinNames(invitation.guests)}`;
  });

  // Lukt het opbouwen niet (of duurt het te lang), dan gaat de gast zonder envelop door naar de uitnodiging.
  let light;
  try {
    const tooSlow = new Promise((_, reject) => setTimeout(() => reject(new Error('envelop te traag')), 10000));
    light = await Promise.race([buildEnvelope($('#env-stage'), 'assets/envelop-strand.png'), tooSlow]);
  } catch {
    return remove();
  }
  envelope.classList.add('ready'); // nu pas "Tik op het zegel" tonen

  const music = prepareMusic('assets/strand-feestje.m4a');
  const timers = [];
  const later = (action, ms) => timers.push(setTimeout(action, ms));
  let endFlight = () => {}; // ruimt de vliegende namen op als de opening wordt overgeslagen

  // Wie de opening al eens heeft gezien, kan meteen door; tijdens het openen kan iedereen overslaan.
  const skipButton = $('#env-skip');
  const remember = (key, storage) => {
    try {
      storage.setItem(key, '1');
    } catch {}
  };
  let seenBefore = false;
  try {
    seenBefore = localStorage.getItem('envelope-seen') === '1';
  } catch {}
  skipButton.hidden = !seenBefore;
  skipButton.addEventListener('click', () => {
    timers.forEach(clearTimeout);
    light.stop();
    music.stop();
    endFlight();
    remember('envelope-opened', sessionStorage);
    remove();
  });

  const open = () => {
    music.play();
    // zonlicht over folie en zegel → zegel breekt → kleppen open → zee met namen → namen vliegen naar de site
    const step = (className, ms) => later(() => envelope.classList.add(className), ms);
    envelope.classList.add('lit');
    light.start();
    remember('envelope-opened', sessionStorage);
    remember('envelope-seen', localStorage);
    skipButton.textContent = 'Overslaan';
    skipButton.hidden = false;
    step('crack', 1450);
    step('open', 1800);
    step('names', 3100);
    later(() => fillWithSunset(1), 2900);
    // de zonsondergang met jullie namen blijft even rustig in beeld
    later(flyNames, 6800);
    later(() => fillWithSunset(1.06), 6800);
    step('fade', 7200);
    later(() => document.body.classList.remove('is-sealed'), 7800);
    later(() => {
      light.stop();
      remove();
    }, 10000);
  };

  // De camera gaat de envelop in: de zonsondergang vult daarna het hele scherm.
  const fillWithSunset = (extra) => {
    const scene = $('.env-scene');
    const inside = $('.env-inside');
    // maten zonder de transformatie van de scène: de stage zelf beweegt niet, offset* negeert transforms
    const sr = $('#env-stage').getBoundingClientRect();
    const scale = Math.max(innerWidth / inside.offsetWidth, innerHeight / inside.offsetHeight) * extra;
    const cx = inside.offsetLeft + inside.offsetWidth / 2;
    const cy = inside.offsetTop + inside.offsetHeight / 2;
    // de namen houden op elk scherm een prettige breedte, ook als de foto aan de zijkanten wegvalt
    const names = $('.env-inside-text .lettering');
    names.style.width = `${Math.min(innerWidth * 0.84, 560) / scale}px`;
    $('.env-inside-date').style.fontSize = `${12 / scale}px`;
    scene.style.transformOrigin = '0 0';
    scene.style.transform = `translate(${innerWidth / 2 - sr.left - cx * scale}px, ${innerHeight / 2 - sr.top - cy * scale}px) scale(${scale})`;
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
    // het doel kan onderweg verschuiven (bijv. als de scrollbalk verschijnt); dan vliegen de namen mee
    let target = b;
    let follow = requestAnimationFrame(function track() {
      const now = to.getBoundingClientRect();
      if (Math.abs(now.left - target.left) + Math.abs(now.top - target.top) + Math.abs(now.width - target.width) > 0.5) {
        target = now;
        Object.assign(flight.style, { left: `${now.left}px`, top: `${now.top}px`, width: `${now.width}px` });
      }
      follow = requestAnimationFrame(track);
    });
    const land = () => {
      cancelAnimationFrame(follow);
      // eerst de echte namen tonen (zonder hun eigen intro-animatie), dan pas de vliegende kopie weg
      document.body.classList.add('names-landed');
      document.body.classList.remove('names-handoff');
      requestAnimationFrame(() => requestAnimationFrame(() => flight.remove()));
    };
    const landing = setTimeout(land, 2700);
    endFlight = () => {
      clearTimeout(landing);
      land();
    };
  };
  // ?envstate=lit,crack,open,names&envt=1.2 zet de envelop stil in die stand (om te testen en te vergelijken).
  const params = new URLSearchParams(location.search);
  const preview = params.get('envstate');
  if (preview) {
    envelope.classList.add('no-anim', ...preview.split(','));
    if (preview.includes('lit')) light.render(Number(params.get('envt') ?? 1.2));
    if (preview.includes('names')) fillWithSunset(1);
  }

  $('#seal').addEventListener('click', open, { once: true });
  envelope.addEventListener('click', (event) => {
    if (event.target !== $('#seal') && event.target !== skipButton && !envelope.classList.contains('lit')) $('#seal').click();
  });
}

// Strand bij zonsondergang met in de verte de riff van onze openingsdans: heel zacht bij het openen, daarna langzaam weg.
// Het zachte volume en de fades zitten in het bestand zelf. Zo kan het via een gewoon <audio>-element,
// dat op iPhones ook speelt als de telefoon op stil staat (Web Audio blijft dan stil).
function prepareMusic(src) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  return {
    play() {
      try {
        // nieuwere iPhones: geluid als mediaweergave behandelen, dus ook met de stille modus aan
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
        audio.play().catch(() => {});
      } catch {
        // geen geluid is geen probleem; de opening werkt gewoon door
      }
    },
    stop() {
      audio.pause();
    },
  };
}

function showCodeForm(error) {
  const form = $('#code-form');
  form.hidden = false;
  $('#code-error').textContent = error;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = cleanCode($('#code-input').value);
    if (!code) return;
    let invitation;
    try {
      invitation = await getInvitation(code);
    } catch {
      $('#code-error').textContent = LOAD_ERROR;
      return;
    }
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

  $('#greeting').textContent = `Lieve ${invitation.greeting || joinNames(invitation.guests)}`;
  if (!isDay) {
    $('.hero-lead').textContent = 'Wij gaan trouwen en geven een feest!';
    $('#hero-place').textContent = `Strandclub Witsand · vanaf ${eveningStart}`;
  }
  $('#scroll-cue').hidden = false;

  const main = $('#invitation');
  main.innerHTML = renderSections(invitation, plural);
  main.hidden = false;

  startCountdown(isDay);
  setupReveal();
  setupFloatingRsvp();
  setupSwipe();

  loadRsvp(invitation);
}

// Haalt een eerder gegeven antwoord op. Lukt dat niet, dan tonen we geen leeg formulier
// (dat zou een eerder antwoord ongemerkt kunnen overschrijven) maar een melding met een knop om het opnieuw te proberen.
async function loadRsvp(invitation) {
  const card = $('#rsvp-card');
  card.innerHTML = '<p class="rsvp-status">Even geduld…</p>';
  try {
    const rsvp = await getRsvp(invitation.code);
    if (rsvp) {
      renderConfirmation(invitation, rsvp);
    } else {
      renderForm(invitation);
    }
  } catch {
    card.innerHTML = `
      <p class="rsvp-status">Het formulier kon niet geladen worden. Controleer je internetverbinding.</p>
      <button class="button" type="button" id="retry-rsvp">Probeer opnieuw</button>`;
    $('#retry-rsvp').addEventListener('click', () => loadRsvp(invitation));
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
          <h2 class="title">Wij zeggen <em>ja</em>!</h2>
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
        ${venue.siteUrl ? `<p class="venue-site"><a href="${venue.siteUrl}" target="_blank" rel="noopener">${escapeHtml(venue.siteUrl.replace(/^https?:\/\/(www\.)?|\/$/g, ''))}</a></p>` : ''}
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
              ${item.links ? `<p class="faq-links">${item.links.map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>`).join('')}</p>` : ''}
            </details>`,
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section section-tint" id="rsvp">
      <div class="section-inner reveal">
        <p class="eyebrow">RSVP</p>
        <h2 class="title">${plural ? 'Vieren jullie met ons mee?' : 'Vier je met ons mee?'}</h2>
        <p class="lead">Laat het ons uiterlijk ${CONTENT.rsvpDeadline} weten.</p>
      </div>
      <div class="rsvp-card" id="rsvp-card"></div>
    </section>

    <footer class="footer">
      <p class="lettering" role="img" aria-label="${escapeHtml(CONTENT.couple)}"></p>
      <p class="eyebrow">25 · 06 · 2027</p>
      <p class="credits">Strandgeluid: Beeld en Geluid (<a href="https://commons.wikimedia.org/wiki/File:De_branding_aan_het_strand_-_SoundCloud_-_Beeld_en_Geluid.ogg" target="_blank" rel="noopener">branding</a>, <a href="https://commons.wikimedia.org/wiki/File:Spelen_van_kinderen_aan_het_strand_-_SoundCloud_-_Beeld_en_Geluid.ogg" target="_blank" rel="noopener">strand</a>), CC BY-SA 3.0</p>
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
        ${renderMatch()}
        <p class="lead">${escapeHtml(moments.intro)}</p>
      </div>
      <ul class="polaroids">
        ${moments.items
          .map(
            (item) => `
          <li class="polaroid">
            <figure>
              <span class="polaroid-photo"><img src="${item.src}" alt="${escapeHtml(item.alt ?? item.caption ?? 'Maaike en Bas')}" loading="lazy" style="object-position:${item.position ?? '50% 50%'}${item.zoom ? `;transform:scale(${item.zoom})` : ''}"></span>
              ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
            </figure>
          </li>`,
          )
          .join('')}
      </ul>
    </section>`;
}

// Hoe het begon: profielkaartjes om naar rechts te swipen (of op het hartje te tikken).
function renderMatch() {
  const { match } = CONTENT;
  if (!match?.profiles?.length) return '';
  const cards = match.profiles
    .map(
      (p, i) => `
        <article class="swipe-card" data-index="${i}" aria-label="Profiel van ${escapeHtml(p.name)}"${i ? ' aria-hidden="true"' : ''}>
          <img src="${p.photo}" alt="" loading="lazy" style="object-position:${p.position ?? '50% 50%'}${p.zoom ? `;transform:scale(${p.zoom});transform-origin:${p.position ?? '50% 50%'}` : ''}" draggable="false">
          <span class="swipe-stamp swipe-stamp-yes" aria-hidden="true">Ja!</span>
          <span class="swipe-stamp swipe-stamp-no" aria-hidden="true">Nee</span>
          <div class="swipe-info">
            <h3>${escapeHtml(p.name)}${p.age ? ` <span class="swipe-age">${p.age}</span>` : ''}</h3>
            ${match.distance ? `<p class="swipe-distance"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>${escapeHtml(match.distance)}</p>` : ''}
            <p class="swipe-since">${escapeHtml(match.since ?? '')}</p>
            <p class="swipe-bio">${escapeHtml(p.bio)}</p>
          </div>
        </article>`,
    )
    .reverse() // het eerste profiel ligt bovenop
    .join('');
  return `
    <div class="swipe" id="swipe">
      <p class="swipe-intro">${escapeHtml(match.intro)}</p>
      <div class="swipe-deck">
        ${cards}
        <div class="swipe-match" hidden>
          <div class="swipe-match-photos" aria-hidden="true">
            ${match.profiles.map((p) => `<img src="${p.photo}" alt="" style="object-position:${p.position ?? '50% 50%'}">`).join('')}
          </div>
          <p class="swipe-match-title">${escapeHtml(match.title)}</p>
          <p class="swipe-match-text">${escapeHtml(match.text)}</p>
          <button type="button" class="swipe-again">Nog een keer swipen</button>
        </div>
      </div>
      <div class="swipe-controls">
      ${match.how ? `<p class="swipe-how"><span>${escapeHtml(match.how)}</span><svg viewBox="0 0 40 16" aria-hidden="true"><path d="M2 8h34M29 2l7 6-7 6"/></svg></p>` : ''}
      <div class="swipe-buttons">
        <button type="button" class="swipe-btn swipe-btn-no" aria-label="Naar links: nee">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <button type="button" class="swipe-btn swipe-btn-yes" aria-label="Naar rechts: ja">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
        </button>
      </div>
      </div>
      <p class="swipe-note" aria-live="polite"></p>
    </div>`;
}

function setupSwipe() {
  const root = $('#swipe');
  if (!root) return;
  const { match } = CONTENT;
  const deck = $('.swipe-deck', root);
  const note = $('.swipe-note', root);
  const buttons = $('.swipe-controls', root);
  const matchCard = $('.swipe-match', root);
  const cards = () => [...root.querySelectorAll('.swipe-card:not(.is-gone)')].sort((a, b) => a.dataset.index - b.dataset.index);
  const THRESHOLD = 90;
  let lefts = 0;
  let lastLeft = -1;
  let busy = false;

  const setDrag = (card, x) => {
    card.style.transform = `translateX(${x}px) rotate(${x / 18}deg)`;
    card.style.setProperty('--yes', Math.max(0, Math.min(1, x / THRESHOLD)));
    card.style.setProperty('--no', Math.max(0, Math.min(1, -x / THRESHOLD)));
  };

  const like = (card) => {
    busy = true;
    note.textContent = '';
    card.classList.add('is-flying');
    setDrag(card, Math.max(deck.offsetWidth, 320) * 1.4);
    card.classList.add('is-gone');
    const next = cards()[0];
    if (next) next.removeAttribute('aria-hidden');
    setTimeout(() => {
      card.hidden = true;
      busy = false;
      if (!next) showMatch();
    }, 450);
  };

  const refuse = (card) => {
    // eerst altijd de eerste tekst, daarna willekeurig, maar nooit twee keer dezelfde achter elkaar
    let pick = 0;
    if (lefts > 0 && match.left.length > 1) {
      do pick = Math.floor(Math.random() * match.left.length);
      while (pick === lastLeft);
    }
    lastLeft = pick;
    note.textContent = match.left[pick];
    lefts += 1;
    card.classList.add('is-flying');
    setDrag(card, 0);
    card.classList.remove('is-shaking');
    void card.offsetWidth;
    card.classList.add('is-shaking');
  };

  const showMatch = () => {
    // na de match zijn de knoppen, de pil en de meldingen niet meer nodig
    buttons.hidden = true;
    note.hidden = true;
    matchCard.hidden = false;
    requestAnimationFrame(() => matchCard.classList.add('is-shown'));
  };

  $('.swipe-again', root).addEventListener('click', () => {
    matchCard.classList.remove('is-shown');
    matchCard.hidden = true;
    buttons.hidden = false;
    note.hidden = false;
    note.textContent = '';
    lefts = 0;
    root.querySelectorAll('.swipe-card').forEach((card, i, all) => {
      card.hidden = false;
      card.classList.remove('is-gone', 'is-flying', 'is-shaking');
      card.style.transform = '';
      card.style.removeProperty('--yes');
      card.style.removeProperty('--no');
      // de eerste in de lijst (het laatste profiel) ligt onderop
      if (i === all.length - 1) card.removeAttribute('aria-hidden');
      else card.setAttribute('aria-hidden', 'true');
    });
  });

  $('.swipe-btn-yes', root).addEventListener('click', () => {
    const card = cards()[0];
    if (card && !busy) like(card);
  });
  $('.swipe-btn-no', root).addEventListener('click', () => {
    const card = cards()[0];
    if (!card || busy) return;
    card.classList.remove('is-flying');
    setDrag(card, -60);
    requestAnimationFrame(() => requestAnimationFrame(() => refuse(card)));
  });

  // Zodra de kaartjes in beeld komen, geeft het bovenste een duwtje naar rechts: zo zie je dat je kunt swipen.
  let touched = false;
  root.addEventListener('pointerdown', () => { touched = true; }, { once: true });
  const nudge = () => {
    const card = cards()[0];
    if (touched || busy || !card || card.dataset.index !== '0') return;
    card.classList.add('is-flying');
    setDrag(card, 70);
    setTimeout(() => { if (!touched) setDrag(card, 0); }, 650);
  };
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      setTimeout(nudge, 700);
      setTimeout(nudge, 5000); // nog een keer als er nog niet geswipet is
    },
    { threshold: 0.35 },
  ).observe(deck);

  // Slepen met vinger of muis; verticaal scrollen op de telefoon blijft gewoon werken.
  let drag = null;
  deck.addEventListener('pointerdown', (event) => {
    const card = event.target.closest('.swipe-card');
    if (!card || busy || card !== cards()[0] || event.button > 0) return;
    drag = { card, startX: event.clientX, startY: event.clientY, x: 0, active: false, id: event.pointerId };
  });
  deck.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // de gast scrolt
      drag.active = true;
      drag.card.classList.remove('is-flying', 'is-shaking');
      deck.setPointerCapture(event.pointerId);
    }
    drag.x = dx;
    setDrag(drag.card, dx);
  });
  const release = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { card, x, active } = drag;
    drag = null;
    if (!active) return;
    if (x > THRESHOLD) like(card);
    else if (x < -THRESHOLD) refuse(card);
    else {
      card.classList.add('is-flying');
      setDrag(card, 0);
    }
  };
  deck.addEventListener('pointerup', release);
  deck.addEventListener('pointercancel', release);
}

// Daggasten tellen af naar de ontvangst, avondgasten naar het begin van het avondfeest.
function startCountdown(isDay) {
  const first = CONTENT.program.find((item) => isDay || !item.dagOnly);
  const wedding = new Date(`${CONTENT.date}T${first.time}:00${CONTENT.utcOffset}`);
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

function choicesHtml(name, type, selected, { withDecline = true } = {}) {
  return `
    <div class="choices" role="radiogroup">
      ${OPTIONS[type]
        .filter(([value]) => withDecline || value !== 'nee')
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
              <input id="diet-${i}" name="diet-${i}" maxlength="300" value="${escapeHtml(answer?.diet)}">
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
              <input id="plus-name" name="plus-name" autocomplete="off" maxlength="100" value="${escapeHtml(plusOne?.name)}">
            </div>
            ${
              invitation.type === 'dag'
                ? `<div class="field"><label>Aanwezig</label>${choicesHtml('att-plus', 'dag', plusOne?.attendance, { withDecline: false })}</div>`
                : ''
            }
            <div class="field">
              <label for="plus-diet">Dieetwensen of allergieën <span class="hint">(optioneel)</span></label>
              <input id="plus-diet" name="plus-diet" maxlength="300" value="${escapeHtml(plusOne?.diet)}">
            </div>
          </div>
        </fieldset>`
          : ''
      }

      <div class="field">
        <label for="song">Welk nummer krijgt jou gegarandeerd de dansvloer op? <span class="hint">(optioneel)</span></label>
        <input id="song" name="song" maxlength="200" value="${escapeHtml(previous?.song)}">
      </div>
      <div class="field">
        <label for="message">Nog iets dat je met ons wilt delen? <span class="hint">(optioneel)</span></label>
        <textarea id="message" name="message" maxlength="2000">${escapeHtml(previous?.message)}</textarea>
      </div>
      <div class="field wish-field">
        <label for="wish">Een lieve boodschap of wens voor ons <span class="hint">(optioneel)</span></label>
        <textarea id="wish" name="wish" rows="5" maxlength="2000" placeholder="Een wens, een mooie herinnering of een goed advies voor het bruidspaar…">${escapeHtml(previous?.wish)}</textarea>
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
    $('#form-error').textContent = result.error ?? '';
    if (result.error) return;
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    button.textContent = 'Versturen…';
    try {
      const saved = await saveRsvp(invitation.code, result.rsvp);
      renderConfirmation(invitation, saved);
      $('#rsvp').scrollIntoView();
    } catch {
      $('#form-error').textContent = 'Het versturen is niet gelukt. Je antwoord is nog niet opgeslagen. Controleer je internetverbinding en probeer het nog eens.';
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
      wish: data.get('wish').trim(),
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
    ? `Leuk dat ${plural ? 'jullie' : 'je'} erbij ${plural ? 'zijn' : 'bent'}. We kijken ernaar uit!`
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
    const midnight = time === '24:00'; // niet elke browser leest 24:00 als tijdstip
    const date = new Date(`${CONTENT.date}T${midnight ? '00:00' : time}:00${CONTENT.utcOffset}`);
    if (nextDay || midnight) date.setUTCDate(date.getUTCDate() + 1);
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
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

init();
