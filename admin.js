import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL } from './config.js';
import { isDemo, DEMO_INVITATIONS, demoRsvp } from './api.js';

const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ATTENDANCE = { beide: 'Dag & avond', dag: 'Alleen overdag', avond: 'Avond', nee: 'Kan niet' };
const comesDay = (a) => a === 'beide' || a === 'dag';
const comesEvening = (a) => a === 'beide' || a === 'avond';

let invitations = []; // { code, household, greeting, type, guests, plusOne }
let rsvps = new Map(); // code → { guests, plusOne, song, message, wish, submittedAt }
let filter = 'all';
let source;
let shownExampleNotice = false;

/* ---------- Databron: Supabase of demo ---------- */

async function supabaseSource() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm');
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const fail = (error) => {
    if (error) throw new Error(error.message);
  };
  return {
    async session() {
      return (await client.auth.getSession()).data.session;
    },
    async login(email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
      });
      fail(error);
    },
    async logout() {
      await client.auth.signOut();
    },
    async isAdmin() {
      const { data, error } = await client.from('admins').select('email');
      fail(error);
      return data.length > 0;
    },
    async load() {
      const [inv, ans] = await Promise.all([
        client.from('invitations').select('*').order('created_at'),
        client.from('rsvps').select('*'),
      ]);
      fail(inv.error);
      fail(ans.error);
      return {
        invitations: inv.data.map((row) => ({ ...row, plusOne: row.plus_one })),
        rsvps: ans.data.map((row) => ({ ...row, plusOne: row.plus_one, submittedAt: row.updated_at })),
      };
    },
    async add(invitation) {
      const { error } = await client.from('invitations').insert({
        household: invitation.household,
        greeting: invitation.greeting || null,
        type: invitation.type,
        guests: invitation.guests,
        plus_one: invitation.plusOne,
      });
      fail(error);
    },
    async addMany(list) {
      const { error } = await client.from('invitations').insert(
        list.map((invitation) => ({
          household: invitation.household,
          greeting: invitation.greeting || null,
          type: invitation.type,
          guests: invitation.guests,
          plus_one: invitation.plusOne,
        })),
      );
      fail(error);
    },
    // rsvpChange: null (antwoord blijft zoals het is), 'delete' of { guests, plusOne }
    async update(code, invitation, rsvpChange) {
      const { error } = await client
        .from('invitations')
        .update({
          household: invitation.household,
          greeting: invitation.greeting || null,
          type: invitation.type,
          guests: invitation.guests,
          plus_one: invitation.plusOne,
        })
        .eq('code', code);
      fail(error);
      if (rsvpChange === 'delete') {
        fail((await client.from('rsvps').delete().eq('code', code)).error);
      } else if (rsvpChange) {
        fail((await client.from('rsvps').update({ guests: rsvpChange.guests, plus_one: rsvpChange.plusOne }).eq('code', code)).error);
      }
    },
    async remove(code) {
      const { error } = await client.from('invitations').delete().eq('code', code);
      fail(error);
    },
  };
}

function demoSource() {
  const list = Object.entries(DEMO_INVITATIONS).map(([code, inv]) => ({ code, ...inv }));
  return {
    session: async () => true,
    isAdmin: async () => true,
    logout: async () => {},
    async load() {
      return {
        invitations: list,
        rsvps: list.map((inv) => ({ code: inv.code, ...demoRsvp(inv.code) })).filter((r) => r.guests),
      };
    },
    async add(invitation) {
      list.push({ code: Math.random().toString(36).slice(2, 8).toUpperCase(), ...invitation });
    },
    async addMany(many) {
      for (const invitation of many) await this.add(invitation);
    },
    async update(code, invitation, rsvpChange) {
      Object.assign(list.find((inv) => inv.code === code), invitation);
      const key = `rsvp:${code}`;
      if (rsvpChange === 'delete') localStorage.removeItem(key);
      else if (rsvpChange) localStorage.setItem(key, JSON.stringify({ ...demoRsvp(code), ...rsvpChange }));
    },
    async remove(code) {
      list.splice(list.findIndex((inv) => inv.code === code), 1);
    },
  };
}

/* ---------- Start ---------- */

async function init() {
  source = isDemo ? demoSource() : await supabaseSource();
  if (isDemo) notice('Demomodus: er is nog geen database gekoppeld. Je ziet de voorbeelduitnodigingen en de antwoorden uit deze browser.');

  if (!(await source.session())) return showLogin();
  if (!(await source.isAdmin())) {
    notice('Dit e-mailadres heeft geen toegang tot het beheer.');
    return showLogout();
  }
  showLogout();
  $('#dashboard').hidden = false;
  await refresh();
}

// Toont een melding bovenaan, eventueel met een knop erbij.
function notice(text, actionLabel, action) {
  const el = $('#notice');
  el.textContent = text;
  if (actionLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-button notice-action';
    button.textContent = actionLabel;
    button.addEventListener('click', action);
    el.append(button);
  }
  el.hidden = false;
}

function showLogout() {
  if (isDemo) return;
  const button = $('#logout');
  button.hidden = false;
  button.addEventListener('click', async () => {
    await source.logout();
    location.reload();
  });
}

function showLogin() {
  $('#login').hidden = false;
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#login-message');
    try {
      await source.login($('#login-email').value.trim());
      message.textContent = 'Kijk in je mailbox en klik op de link om in te loggen.';
    } catch (error) {
      message.textContent = `Dat lukte niet: ${error.message}`;
    }
  });
}

async function refresh() {
  const data = await source.load();
  invitations = data.invitations;
  rsvps = new Map(data.rsvps.map((r) => [r.code, r]));
  render();
  if (!isDemo) {
    const examples = invitations.filter((inv) => inv.code in DEMO_INVITATIONS).length;
    if (examples) {
      notice(
        `Let op: er staan nog ${examples} voorbeelduitnodigingen in de lijst ("Voorbeeld: …"). Ze tellen mee in de aantallen. Verwijder ze voordat de echte uitnodigingen de deur uit gaan.`,
        'Verwijder de voorbeelden',
        removeExamples,
      );
    } else if (shownExampleNotice) {
      $('#notice').hidden = true;
    }
    shownExampleNotice = examples > 0;
  }
  if (!isDemo || testBackup) weeklyBackup();
}

function removeExamples() {
  if (!confirm('De voorbeelduitnodigingen en hun testantwoorden verwijderen?')) return;
  attempt(async () => {
    for (const inv of invitations.filter((i) => i.code in DEMO_INVITATIONS)) await source.remove(inv.code);
    await refresh();
  });
}

/* ---------- Reservekopie ---------- */

// Eén keer per week, bij het openen van het beheer, downloadt de browser vanzelf een reservekopie
// (hetzelfde bestand als "Exporteer naar Excel"). Bewaar die bestanden; de database zelf maakt geen kopieën.
const BACKUP_KEY = 'backup-at';
const testBackup = new URLSearchParams(location.search).has('testbackup');

function weeklyBackup() {
  let last = 0;
  try {
    last = Number(localStorage.getItem(BACKUP_KEY)) || 0;
  } catch {}
  const week = 7 * 24 * 60 * 60 * 1000;
  if (rsvps.size && Date.now() - last > week) {
    downloadCsv(`reservekopie-gastenlijst-${new Date().toISOString().slice(0, 10)}.csv`);
    last = Date.now();
    try {
      localStorage.setItem(BACKUP_KEY, String(last));
    } catch {}
  }
  $('#backup-info').textContent = last
    ? `Laatste automatische reservekopie: ${new Date(last).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} (in je map Downloads)`
    : '';
}

// Een actie die mislukt (verbinding weg, inlog verlopen) geeft een melding in plaats van stilte.
async function attempt(action) {
  try {
    await action();
  } catch (error) {
    notice(`Dat lukte niet: ${error.message}. Herlaad de pagina en log zo nodig opnieuw in.`);
    $('#notice').scrollIntoView({ block: 'center' });
  }
}

/* ---------- Weergave ---------- */

function peopleOf(rsvp) {
  if (!rsvp) return [];
  return [...rsvp.guests, ...(rsvp.plusOne ? [{ ...rsvp.plusOne, plusOne: true }] : [])];
}

function statusOf(invitation) {
  const rsvp = rsvps.get(invitation.code);
  if (!rsvp) return 'open';
  return peopleOf(rsvp).some((p) => p.attendance !== 'nee') ? 'yes' : 'no';
}

function render() {
  renderStats();
  renderTable();
  renderLists();
}

function renderStats() {
  let invitedDay = 0;
  let invitedEvening = 0;
  let day = 0;
  let evening = 0;
  let declined = 0;
  let open = 0;
  for (const inv of invitations) {
    if (inv.type === 'dag') invitedDay += inv.guests.length;
    else invitedEvening += inv.guests.length;
    const rsvp = rsvps.get(inv.code);
    if (!rsvp) open++;
    for (const person of peopleOf(rsvp)) {
      if (comesDay(person.attendance)) day++;
      if (comesEvening(person.attendance)) evening++;
      if (person.attendance === 'nee') declined++;
    }
  }
  const stat = (value, label, sub = '') => `<div class="stat"><strong>${value}</strong><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  $('#stats').innerHTML = [
    stat(day, 'Overdag', `van ${invitedDay} daggasten`),
    stat(evening, "'s Avonds", `daggasten + avondgasten (${invitedEvening} avondgasten uitgenodigd)`),
    stat(declined, 'Afgemeld', 'personen'),
    stat(open, 'Nog geen reactie', `van ${invitations.length} uitnodigingen`),
  ].join('');
}

// De link voor een gast wijst altijd naar het openbare adres van de site (SITE_URL in config.js),
// ook als je het beheer op je eigen computer opent. Anders zou een gast een link naar "localhost" krijgen.
const siteUrl = (SITE_URL || `${location.origin}${location.pathname.replace(/admin\.html$/, '')}`).replace(/\/*$/, '/');

function inviteLink(code) {
  return `${siteUrl}?c=${code}`;
}

function renderTable() {
  const rows = invitations.filter((inv) => filter === 'all' || statusOf(inv) === filter);
  const badge = { open: 'Nog geen reactie', yes: 'Komt', no: 'Afgemeld' };
  $('#invitations').innerHTML = `
    <thead>
      <tr><th>Huishouden</th><th>Uitgenodigd</th><th>Reactie</th><th>Link</th><th></th></tr>
    </thead>
    <tbody>
      ${rows
        .map((inv) => {
          const rsvp = rsvps.get(inv.code);
          const status = statusOf(inv);
          const people = rsvp
            ? peopleOf(rsvp)
                .map((p) => `${escapeHtml(p.name)}${p.plusOne ? ' (introducé)' : ''}: ${ATTENDANCE[p.attendance]}`)
                .join('<br>')
            : escapeHtml(inv.guests.join(', '));
          return `
          <tr>
            <td><strong>${escapeHtml(inv.household)}</strong><br><span class="muted">${escapeHtml(inv.guests.join(', '))}${inv.plusOne ? ' + introducé' : ''}</span></td>
            <td>${inv.type === 'dag' ? 'Dag &amp; avond' : 'Avond'}</td>
            <td><span class="badge badge-${status}">${badge[status]}</span>${rsvp ? `<div class="muted small">${people}</div>` : ''}</td>
            <td class="link-cell">
              <button type="button" class="link-button" data-copy="${inv.code}">Kopieer link</button>
              <a class="link-button" href="https://wa.me/?text=${encodeURIComponent(whatsappText(inv))}" target="_blank" rel="noopener">WhatsApp</a>
            </td>
            <td>
              <button type="button" class="link-button" data-edit="${inv.code}" aria-label="Bewerk ${escapeHtml(inv.household)}">Bewerk</button>
              <button type="button" class="link-button danger" data-remove="${inv.code}" aria-label="Verwijder ${escapeHtml(inv.household)}">Verwijder</button>
            </td>
          </tr>`;
        })
        .join('')}
    </tbody>`;
}

function whatsappText(inv) {
  const names = inv.guests.length > 1 ? `${inv.guests.slice(0, -1).join(', ')} & ${inv.guests.at(-1)}` : inv.guests[0];
  const yours = inv.guests.length > 1 ? 'jullie' : 'je';
  return `Lieve ${inv.greeting || names}, wij gaan trouwen! Open hier ${yours} uitnodiging: ${inviteLink(inv.code)}`;
}

function renderLists() {
  const diets = [];
  const messages = [];
  const wishes = [];
  for (const inv of invitations) {
    const rsvp = rsvps.get(inv.code);
    if (!rsvp) continue;
    for (const p of peopleOf(rsvp)) {
      if (p.diet && p.attendance !== 'nee') diets.push(`<li><strong>${escapeHtml(p.name)}</strong> ${escapeHtml(p.diet)}</li>`);
    }
    if (rsvp.song) messages.push(`<li><strong>${escapeHtml(inv.household)}</strong> 🎵 ${escapeHtml(rsvp.song)}</li>`);
    if (rsvp.message) messages.push(`<li><strong>${escapeHtml(inv.household)}</strong> ${escapeHtml(rsvp.message)}</li>`);
    if (rsvp.wish) wishes.push(`<li><p>${escapeHtml(rsvp.wish)}</p><strong>${escapeHtml(inv.household)}</strong></li>`);
  }
  $('#wishes').innerHTML = wishes.join('') || '<li class="muted">Nog geen wensen.</li>';
  $('#diets').innerHTML = diets.join('') || '<li class="muted">Nog geen dieetwensen.</li>';
  $('#messages').innerHTML = messages.join('') || '<li class="muted">Nog geen nummers of berichten.</li>';
}

/* ---------- Acties ---------- */

$('#filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  filter = button.dataset.filter;
  document.querySelectorAll('#filters button').forEach((b) => b.classList.toggle('active', b === button));
  renderTable();
});

$('#invitations').addEventListener('click', async (event) => {
  const copy = event.target.closest('[data-copy]');
  if (copy) {
    const link = inviteLink(copy.dataset.copy);
    try {
      await navigator.clipboard.writeText(link);
      copy.textContent = 'Gekopieerd';
      setTimeout(() => (copy.textContent = 'Kopieer link'), 1500);
    } catch {
      // kopiëren mag niet van de browser: dan de link tonen om zelf te kopiëren
      prompt('Kopieer de link:', link);
    }
  }
  const edit = event.target.closest('[data-edit]');
  if (edit) startEdit(invitations.find((i) => i.code === edit.dataset.edit));
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    const inv = invitations.find((i) => i.code === remove.dataset.remove);
    if (!confirm(`Uitnodiging voor ${inv.household} verwijderen? Een eventueel antwoord verdwijnt ook.`)) return;
    await attempt(async () => {
      await source.remove(inv.code);
      await refresh();
    });
  }
});

let editing = null; // de uitnodiging die in het formulier wordt bewerkt, of null bij toevoegen

function startEdit(inv) {
  editing = inv;
  $('#add-title').textContent = 'Uitnodiging bewerken';
  $('#add-submit').textContent = 'Wijzigingen opslaan';
  $('#add-cancel').hidden = false;
  $('#add-household').value = inv.household;
  $('#add-guests').value = inv.guests.join(', ');
  $('#add-greeting').value = inv.greeting ?? '';
  document.querySelector(`input[name="add-type"][value="${inv.type}"]`).checked = true;
  $('#add-plus').checked = inv.plusOne;
  $('#add-error').textContent = '';
  $('#add-title').scrollIntoView({ block: 'start' });
}

function stopEdit() {
  editing = null;
  $('#add-form').reset();
  $('#add-title').textContent = 'Uitnodiging toevoegen';
  $('#add-submit').textContent = 'Toevoegen';
  $('#add-cancel').hidden = true;
  $('#add-error').textContent = '';
}

$('#add-cancel').addEventListener('click', stopEdit);

// Wat er met een al gegeven antwoord moet gebeuren als de uitnodiging verandert:
// niets (null), namen en introducé bijwerken ({ guests, plusOne }) of wissen ('delete') als het niet meer past.
function rsvpAfterEdit(next, rsvp) {
  if (!rsvp) return null;
  const allowed = next.type === 'dag' ? ['beide', 'dag', 'avond', 'nee'] : ['avond', 'nee'];
  const fits = next.guests.length === rsvp.guests.length && peopleOf(rsvp).every((p) => allowed.includes(p.attendance));
  if (!fits) return 'delete';
  return {
    guests: rsvp.guests.map((guest, i) => ({ name: next.guests[i], attendance: guest.attendance, diet: guest.diet ?? '' })),
    plusOne: next.plusOne ? rsvp.plusOne ?? null : null,
  };
}

$('#add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const guests = $('#add-guests')
    .value.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!guests.length) return;
  if (guests.length > 12) {
    $('#add-error').textContent = 'Een uitnodiging kan maximaal 12 personen bevatten.';
    return;
  }
  const invitation = {
    household: $('#add-household').value.trim(),
    greeting: $('#add-greeting').value.trim(),
    type: document.querySelector('input[name="add-type"]:checked').value,
    guests,
    plusOne: $('#add-plus').checked,
  };
  try {
    if (editing) {
      const change = rsvpAfterEdit(invitation, rsvps.get(editing.code));
      if (change === 'delete' && !confirm('Het antwoord dat al is gegeven past niet meer bij deze wijziging (ander aantal personen, of dag en avond gewisseld). Het antwoord wordt gewist en de gasten moeten opnieuw reageren. Doorgaan?')) return;
      await source.update(editing.code, invitation, change);
      stopEdit();
    } else {
      await source.add(invitation);
      event.target.reset();
      $('#add-error').textContent = '';
    }
    await refresh();
  } catch (error) {
    $('#add-error').textContent = `Opslaan lukte niet: ${error.message}`;
  }
});

/* ---------- Gastenlijst inladen ---------- */

let importList = []; // uitnodigingen die klaarstaan om aangemaakt te worden

// Leest geplakte rijen uit een rekenblad (tabs tussen de kolommen, eerste rij is de kop)
// en maakt er uitnodigingen van: één per huishouden.
function parseImport(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean));
  const problems = [];
  if (rows.length < 2) return { list: [], problems: ['Plak minstens de kopregel en één rij.'], skipped: 0 };

  const header = rows[0].map((cell) => cell.toLowerCase());
  const column = (...names) => header.findIndex((cell) => names.some((name) => cell === name || cell.startsWith(name)));
  const col = {
    name: column('naam'),
    first: column('voornaam'),
    household: column('huishouden'),
    type: column('uitnodiging'),
    invited: column('uitgenodigd'),
    plus: column('introduc'),
    greeting: column('aanhef'),
  };
  if (col.name < 0 && col.first < 0) {
    return { list: [], problems: ['Er is geen kolom "Naam" gevonden. Kopieer de kopregel mee.'], skipped: 0 };
  }

  const groups = new Map();
  let skipped = 0;
  rows.slice(1).forEach((cells, index) => {
    const get = (i) => (i >= 0 ? cells[i] ?? '' : '');
    const fullName = get(col.name) || get(col.first);
    if (!fullName) return;
    if (col.invited >= 0 && get(col.invited).toLowerCase() !== 'ja') {
      skipped++;
      return;
    }
    const firstName = get(col.first) || fullName.split(/\s+/)[0];
    const typeText = get(col.type).toLowerCase();
    const type = typeText && !typeText.includes('dag') ? 'avond' : 'dag';
    const key = get(col.household) || `\u0000${index}`; // zonder huishouden: ieder een eigen uitnodiging
    if (!groups.has(key)) {
      groups.set(key, { household: get(col.household) || fullName, greeting: '', type, guests: [], plusOne: false, mixed: false });
    }
    const group = groups.get(key);
    group.guests.push(firstName);
    if (group.type !== type) group.mixed = true;
    if (/^(ja|j|x|1)$/i.test(get(col.plus))) group.plusOne = true;
    if (get(col.greeting)) group.greeting = get(col.greeting);
  });

  const existing = new Set(invitations.map((inv) => inv.household.toLowerCase()));
  const list = [];
  for (const group of groups.values()) {
    if (group.mixed) problems.push(`${group.household}: dag- en avondgasten door elkaar in één huishouden. Niet aangemaakt.`);
    else if (group.guests.length > 12) problems.push(`${group.household}: meer dan 12 personen. Niet aangemaakt.`);
    else if (existing.has(group.household.toLowerCase())) problems.push(`${group.household}: bestaat al. Overgeslagen.`);
    else list.push({ household: group.household, greeting: group.greeting, type: group.type, guests: group.guests, plusOne: group.plusOne });
  }
  return { list, problems, skipped };
}

function renderImport() {
  const text = $('#import-text').value;
  if (!text.trim()) {
    importList = [];
    $('#import-preview').innerHTML = '';
    $('#import-run').hidden = true;
    return;
  }
  const { list, problems, skipped } = parseImport(text);
  importList = list;
  const people = list.reduce((sum, inv) => sum + inv.guests.length, 0);
  $('#import-preview').innerHTML = `
    <p class="import-summary"><strong>${list.length} uitnodigingen</strong> voor ${people} personen staan klaar${skipped ? `; ${skipped} rijen overgeslagen (niet uitgenodigd)` : ''}.</p>
    ${problems.length ? `<ul class="import-help import-problem">${problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join('')}</ul>` : ''}
    ${
      list.length
        ? `<div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Huishouden</th><th>Op de uitnodiging</th><th>Uitgenodigd</th><th>Introducé</th></tr></thead>
        <tbody>${list
          .map(
            (inv) => `<tr>
              <td><strong>${escapeHtml(inv.household)}</strong></td>
              <td>${escapeHtml(inv.greeting || inv.guests.join(', '))}${inv.greeting ? `<br><span class="muted">${escapeHtml(inv.guests.join(', '))}</span>` : ''}</td>
              <td>${inv.type === 'dag' ? 'Dag &amp; avond' : 'Avond'}</td>
              <td>${inv.plusOne ? 'ja' : ''}</td>
            </tr>`,
          )
          .join('')}</tbody></table></div>`
        : ''
    }`;
  const button = $('#import-run');
  button.hidden = !list.length;
  button.textContent = `Maak ${list.length} uitnodigingen aan`;
}

$('#import-text').addEventListener('input', renderImport);
$('#import-run').addEventListener('click', () =>
  attempt(async () => {
    const count = importList.length;
    await source.addMany(importList);
    $('#import-text').value = '';
    renderImport();
    await refresh();
    $('#import-preview').innerHTML = `<p class="import-summary"><strong>${count} uitnodigingen aangemaakt.</strong> Ze staan in de lijst bovenaan.</p>`;
  }),
);

// Eén regel per persoon, met puntkomma's zodat Excel het in kolommen zet.
function downloadCsv(filename) {
  const rows = [['Huishouden', 'Naam', 'Uitgenodigd voor', 'Overdag', 'Avond', 'Afgemeld', 'Dieetwensen', 'Introducé', 'Muziekwens', 'Bericht', 'Wens voor jullie', 'Code', 'Link']];
  for (const inv of invitations) {
    const rsvp = rsvps.get(inv.code);
    const people = rsvp ? peopleOf(rsvp) : inv.guests.map((name) => ({ name }));
    for (const p of people) {
      rows.push([
        inv.household,
        p.name,
        inv.type === 'dag' ? 'Dag & avond' : 'Avond',
        p.attendance ? (comesDay(p.attendance) ? 'ja' : 'nee') : '',
        p.attendance ? (comesEvening(p.attendance) ? 'ja' : 'nee') : '',
        p.attendance === 'nee' ? 'ja' : '',
        p.diet ?? '',
        p.plusOne ? 'ja' : '',
        p === people[0] ? rsvp?.song ?? '' : '',
        p === people[0] ? rsvp?.message ?? '' : '',
        p === people[0] ? rsvp?.wish ?? '' : '',
        inv.code,
        inviteLink(inv.code),
      ]);
    }
  }
  // Begint een tekst met =, +, - of @, dan ziet Excel er een formule in; een apostrof ervoor voorkomt dat.
  const text = (cell) => String(cell).replace(/^(?=[=+\-@\t\r])/, "'");
  const csv = rows.map((row) => row.map((cell) => `"${text(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

$('#export').addEventListener('click', () => downloadCsv('gastenlijst-maaike-en-bas.csv'));

init().catch((error) => notice(`Er ging iets mis: ${error.message}. Herlaad de pagina om het opnieuw te proberen.`));
