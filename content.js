// Alle teksten van de uitnodiging staan hier, zodat ze makkelijk aan te passen zijn.
// Regels met TODO zijn nog niet definitief.

export const CONTENT = {
  couple: 'Maaike & Bas',
  date: '2027-06-25',
  utcOffset: '+02:00', // zomertijd
  rsvpDeadline: '14 mei 2027',

  // Foto's: zet hier het pad naar een foto (bijv. 'assets/foto-strand.jpg').
  photos: {
    portrait: 'assets/foto-uitnodiging-2.jpg', // in de zon onder de uitnodigingstekst
    portraitFocus: { position: '50% 50%', zoom: 1 }, // de foto is al vierkant rond jullie gezichten bijgesneden
    landscape: 'assets/foto-strand.jpg', // liggend, over de volle breedte
  },
  showPhotoPlaceholders: true,

  venue: {
    name: 'Strandclub Witsand',
    address: ['Zeereep 103', '2202 NW Noordwijk'],
    siteUrl: 'https://witsand.nl/',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Strandclub+Witsand+Zeereep+103+Noordwijk',
  },

  intro: {
    dag: 'Op vrijdag 25 juni 2027 zeggen wij ja tegen elkaar, met onze voeten in het zand van Noordwijk. Wij zouden het ontzettend leuk vinden als {jij} deze dag samen met ons {wilt} vieren, vanaf het jawoord tot en met de laatste dans.',
    avond: 'Op vrijdag 25 juni 2027 zeggen wij ja tegen elkaar. \'s Avonds vieren we dat met een feest aan zee, en daar {mag} {jij} natuurlijk niet bij ontbreken.',
  },

  // `dagOnly: true` zien alleen daggasten. `photo` is optioneel.
  // Hoofdonderdelen uit de trouwplanner; de avondgasten zijn welkom vanaf 20:15, zoals op de save the night.
  program: [
    { time: '14:30', title: 'Ontvangst', text: 'Inloop vanaf 14:15, met een glas fizz aan zee', icon: 'glasses', photo: 'assets/sfeer-parasol.jpg', dagOnly: true },
    { time: '15:00', title: 'Ceremonie', text: 'Het jawoord op het strand', icon: 'rings', photo: 'assets/sfeer-ceremonie.jpg', dagOnly: true },
    { time: '16:00', title: 'Toost & borrel', text: 'Proosten met een bubbeltje op het strand', icon: 'cake', photo: 'assets/sfeer-vuurkorf.jpg', dagOnly: true },
    { time: '18:00', title: 'Walking dinner', text: 'Proeven en bijpraten, met live cooking', icon: 'dinner', photo: 'assets/sfeer-lampions.jpg', dagOnly: true },
    { time: '20:15', title: 'Avondfeest', text: 'Inloop om 20:15. Om 20:45 openen wij het feest, waarna we dansen tot middernacht', icon: 'music', photo: 'assets/sfeer-avondfeest.jpg' },
    { time: '24:00', title: 'Einde', text: 'We sluiten de avond af met mooie herinneringen: tijd om naar huis te gaan', icon: 'moon', photo: 'assets/sfeer-zonsondergang.jpg' },
  ],

  // Onze happy moments: polaroids. `caption` (optioneel) zet een handgeschreven onderschrift eronder.
  // `position` bepaalt welk deel van de foto zichtbaar blijft (zoals CSS object-position).
  // Hoe het begon: twee profielkaartjes om naar rechts te swipen, daarna "It's a match!".
  match: {
    intro: 'Weet je hoe het allemaal begon? In januari 2017, met slechts 2 swipes! Doe het ons maar na!',
    how: 'Swipe naar rechts of tik op ♥︎',
    profiles: [
      {
        name: 'Bas',
        age: 44,
        photo: 'assets/tinder-bas.jpg',
        position: '53% 40%',
        bio: 'Lacht graag, zoals je ziet. Houdt van lange diners, strandtenten en een goed gesprek. Zoekt iemand die net zo hard om zijn grappen lacht als hijzelf.',
      },
      {
        name: 'Maaike',
        age: 40,
        photo: 'assets/tinder-maaike.jpg',
        position: '52% 28%',
        zoom: 1.6, // ingezoomd op haar gezicht
        bio: 'Zonnebril op, voetjes in het zand, een drankje bij zonsondergang: mijn ideale avond. Zoekt iemand die daar net zo blij van wordt en daarna nog wil dansen tot in de late uurtjes.',
      },
    ],
    since: 'Actief in januari 2017',
    distance: '15 km afstand',
    left: [
      'Naar links? Dat hebben wij gelukkig niet gedaan. Probeer het nog eens.',
      'Echt niet. Hier swipen we alleen naar rechts.',
      'Het hartje zit rechts, hoor.',
      'Links is uitverkocht. Probeer rechts eens.',
      'Wij twijfelden ook geen seconde. Naar rechts!',
      'Weet je het zeker? Kijk nog eens goed naar die glimlach.',
      'Computer says no. Alleen rechts werkt hier.',
      'Dan was er nooit een bruiloft geweest. Nog een poging?',
      'Bijna goed! De andere kant op.',
      'Zelfs je duim weet beter. Naar rechts ermee.',
    ],
    title: "It's a match!",
    text: 'In januari 2017 swipeten we allebei naar rechts. De rest is geschiedenis.',
  },

  moments: {
    title: 'Onze happy moments',
    intro: 'In die 10 jaar daarna kwamen er heel veel mooie momenten bij, van ons samen en met onze 5 kids. Van festivals tot strand, van samen op de scooter tot in het theater, van avondjes uit tot samen cozy op de bank: hieronder een kleine greep uit onze mooiste momenten. En op 25 juni 2027 komt daar natuurlijk de allermooiste bij!',
    items: [
      { src: 'assets/moment-strand.jpg', position: '50% 40%' },
      { src: 'assets/moment-gezin.jpg', position: '49% 40%', alt: 'Maaike en Bas met de kids' },
      { src: 'assets/moment-scooter.jpg', position: '50% 45%' },
      { src: 'assets/moment-theater2.jpg', position: '50% 60%' },
      { src: 'assets/moment-festival.jpg', position: '50% 35%' },
      { src: 'assets/moment-boot.jpg', position: '48% 48%', zoom: 1.5 },
      { src: 'assets/moment-disco.jpg', position: '50% 55%' },
      { src: 'assets/moment-ei.jpg', position: '50% 50%' },
      { src: 'assets/moment-kids.jpg', position: '60% 50%', alt: 'Maaike en Bas met de kids' },
      { src: 'assets/moment-herfst.jpg', position: '45% 45%' },
      { src: 'assets/moment-tunnel.jpg', position: '50% 75%' },
      { src: 'assets/moment-theater.jpg', position: '50% 45%' },
      { src: 'assets/moment-avond.jpg', position: '50% 55%' },
      { src: 'assets/moment-zonsondergang.jpg', position: '53% 78%' },
    ],
  },

  dresscode: {
    title: 'Summer chic',
    text: 'Denk aan zomers, stijlvol en comfortabel, in zachte natuurlijke tinten. We vieren ons feest aan zee: houd rekening met zand onder je voeten en neem voor de avond iets warms mee.',
    // TODO: kleuren naar wens aanpassen
    colors: [
      { name: 'Ivoor', hex: '#f1ebe0' },
      { name: 'Zand', hex: '#d8c7ad' },
      { name: 'Salie', hex: '#a7b5a8' },
      { name: 'Zeeblauw', hex: '#a3b8c4' },
      { name: 'Terracotta', hex: '#d2a68f' },
    ],
  },

  faq: [
    {
      q: 'Zijn kinderen welkom?',
      a: 'We vieren deze dag in gezelschap van familie en vrienden. Kinderen die mee uitgenodigd zijn, staan bij naam op de uitnodiging.',
    },
    { q: 'Mag ik iemand meenemen?', a: 'Als je een introducé mag meenemen, zie je dat terug in het RSVP-formulier.' },
    {
      q: 'Hoe zit het met parkeren?',
      a: 'Rondom Strandclub Witsand zijn verschillende betaalde parkeerterreinen en een parkeergarage. Wij raden Parkeergarage Oude Zeeweg, Parking Koningin Astrid Boulevard, Parkeerplaats Wantveld of de parkeerplaats aan de Nieuwe Zeeweg aan. Vanaf daar loop je in een paar minuten naar Witsand.',
    },
    {
      q: 'Een cadeautip?',
      a: 'Jullie aanwezigheid op onze trouwdag is voor ons het allermooiste cadeau! Wil je toch iets geven, dan waarderen we een donatie aan Alzheimer Nederland en/of het Prinses Máxima Centrum: twee goede doelen die ons erg na aan het hart liggen.',
      links: [
        { label: 'Onze actiepagina voor Alzheimer Nederland', url: 'https://vierjefeestje.alzheimer-nederland.nl/maaike-en-bastiaan-sommeling' },
        { label: 'Onze actiepagina voor het Prinses Máxima Centrum', url: 'https://particulier.maximaalinactie.nl/fundraisers/maaike-van-der-meer' },
      ],
    },
    { q: 'Waar kan ik overnachten?', a: 'Informatie volgt.' }, // TODO
    { q: 'Ik wil iets voorbereiden. Bij wie kan ik terecht?', a: 'De contactgegevens van onze ceremoniemeester volgen.' }, // TODO
  ],
};
