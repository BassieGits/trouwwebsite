import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { isDemo, DEMO_INVITATIONS, demoRsvp } from './api.js';

const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ATTENDANCE = { beide: 'Dag & avond', dag: 'Alleen overdag', avond: 'Avond', nee: 'Kan niet' };
const comesDay = (a) => a === 'beide' || a === 'dag';
const comesEvening = (a) => a === 'beide' || a === 'avond';

let invitations = []; // { code, household, greeting, type, guests, plusOne }
let rsvps = new Map(); // code → { guests, plusOne, song, message, submittedAt }
let filter = 'all';
let source;

/* ---------- Databron: Supabase of demo ---------- */

async function supabaseSource() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
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

function notice(text) {
  const el = $('#notice');
  el.textContent = text;
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

function inviteLink(code) {
  return `${location.origin}${location.pathname.replace(/admin\.html$/, '')}?c=${code}`;
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
            <td><button type="button" class="link-button danger" data-remove="${inv.code}" aria-label="Verwijder ${escapeHtml(inv.household)}">Verwijder</button></td>
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
  for (const inv of invitations) {
    const rsvp = rsvps.get(inv.code);
    if (!rsvp) continue;
    for (const p of peopleOf(rsvp)) {
      if (p.diet && p.attendance !== 'nee') diets.push(`<li><strong>${escapeHtml(p.name)}</strong> ${escapeHtml(p.diet)}</li>`);
    }
    if (rsvp.song) messages.push(`<li><strong>${escapeHtml(inv.household)}</strong> 🎵 ${escapeHtml(rsvp.song)}</li>`);
    if (rsvp.message) messages.push(`<li><strong>${escapeHtml(inv.household)}</strong> ${escapeHtml(rsvp.message)}</li>`);
  }
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
    await navigator.clipboard.writeText(inviteLink(copy.dataset.copy));
    copy.textContent = 'Gekopieerd';
    setTimeout(() => (copy.textContent = 'Kopieer link'), 1500);
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    const inv = invitations.find((i) => i.code === remove.dataset.remove);
    if (!confirm(`Uitnodiging voor ${inv.household} verwijderen? Een eventueel antwoord verdwijnt ook.`)) return;
    await source.remove(inv.code);
    await refresh();
  }
});

$('#add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const guests = $('#add-guests')
    .value.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!guests.length) return;
  try {
    await source.add({
      household: $('#add-household').value.trim(),
      greeting: $('#add-greeting').value.trim(),
      type: document.querySelector('input[name="add-type"]:checked').value,
      guests,
      plusOne: $('#add-plus').checked,
    });
    event.target.reset();
    $('#add-error').textContent = '';
    await refresh();
  } catch (error) {
    $('#add-error').textContent = `Toevoegen lukte niet: ${error.message}`;
  }
});

// Eén regel per persoon, met puntkomma's zodat Excel het in kolommen zet.
$('#export').addEventListener('click', () => {
  const rows = [['Huishouden', 'Naam', 'Uitgenodigd voor', 'Overdag', 'Avond', 'Afgemeld', 'Dieetwensen', 'Introducé', 'Code', 'Link']];
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
        inv.code,
        inviteLink(inv.code),
      ]);
    }
  }
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'gastenlijst-maaike-en-bas.csv';
  link.click();
  URL.revokeObjectURL(link.href);
});

init().catch((error) => notice(`Er ging iets mis: ${error.message}`));
