// Opslag van uitnodigingen en antwoorden.
// Met Supabase-gegevens in config.js gaat alles naar de centrale database;
// zonder die gegevens draait de site in demomodus en blijven antwoorden in deze browser.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// Nieuwe sleutels (sb_publishable_...) horen alleen in de apikey-kop; de oudere sleutels (een lange reeks
// die met eyJ begint) verwacht Supabase daarnaast ook in Authorization.
const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

async function rpc(name, args) {
  // na 15 seconden opgeven, zodat een gast een melding krijgt in plaats van eindeloos te wachten
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${name} mislukt (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Demomodus ---------- */

// type: 'dag' (dag + avond uitgenodigd) of 'avond' (alleen het avondfeest)
export const DEMO_INVITATIONS = {
  DAGDEMO: { household: 'Voorbeeld: Jan & Petra', type: 'dag', guests: ['Jan', 'Petra'], plusOne: false },
  AVONDDEMO: { household: 'Voorbeeld: Sanne', type: 'avond', guests: ['Sanne'], plusOne: true },
  FAMDEMO: { household: 'Voorbeeld: familie met kinderen', type: 'dag', guests: ['Ruud', 'Ellen', 'Tim', 'Noor'], plusOne: false },
};

const storageKey = (code) => `rsvp:${code}`;

export function demoRsvp(code) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(code)));
  } catch {
    return null;
  }
}

/* ---------- Voor gasten ---------- */

export async function getInvitation(code) {
  if (isDemo) {
    const invitation = DEMO_INVITATIONS[code.toUpperCase()];
    return invitation ? { code: code.toUpperCase(), ...invitation } : null;
  }
  return rpc('get_invitation', { p_code: code });
}

export async function getRsvp(code) {
  if (isDemo) return demoRsvp(code);
  return rpc('get_rsvp', { p_code: code });
}

export async function saveRsvp(code, rsvp) {
  if (isDemo) {
    const saved = { ...rsvp, submittedAt: new Date().toISOString() };
    localStorage.setItem(storageKey(code), JSON.stringify(saved));
    return saved;
  }
  return rpc('save_rsvp', { p_code: code, p_rsvp: rsvp });
}
