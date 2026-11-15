// Alle teksten van de uitnodiging staan hier, zodat ze makkelijk aan te passen zijn.
// Regels met TODO zijn nog niet definitief.

export const CONTENT = {
  couple: 'Maaike & Bas',
  date: '2027-06-25',
  utcOffset: '+02:00', // zomertijd
  rsvpDeadline: '1 mei 2027', // TODO: definitieve deadline

  // Foto's: zet hier het pad naar een foto (bijv. 'assets/foto-strand.jpg').
  photos: {
    portrait: 'assets/moment-roos.jpg', // in de zon onder de uitnodigingstekst
    portraitFocus: { position: '54% 22%', zoom: 1.3 }, // ingezoomd op de kus
    landscape: 'assets/foto-strand.jpg', // liggend, over de volle breedte
  },
  showPhotoPlaceholders: true,

  venue: {
    name: 'Strandclub Witsand',
    address: ['Zeereep 103', '2202 NW Noordwijk'],
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Strandclub+Witsand+Zeereep+103+Noordwijk',
  },

  intro: {
    dag: 'Op vrijdag 25 juni 2027 zeggen wij ja tegen elkaar, met onze voeten in het zand van Noordwijk. Het zou ons ontzettend blij maken als {jij} deze dag met ons {wilt} vieren, van het jawoord tot de laatste dans.',
    avond: 'Op vrijdag 25 juni 2027 zeggen wij ja tegen elkaar. \'s Avonds vieren we dat met een feest aan zee, en daar {mag} {jij} natuurlijk niet ontbreken.',
  },

  // `dagOnly: true` zien alleen daggasten. `photo` is optioneel.
  // Hoofdonderdelen uit de trouwplanner; de avondgasten zijn welkom vanaf 20:15, zoals op de save the night.
  program: [
    { time: '14:30', title: 'Ontvangst', text: 'Inloop vanaf 14:15, met een glas fizz aan zee', icon: 'glasses', photo: 'assets/sfeer-parasol.jpg', dagOnly: true },
    { time: '15:00', title: 'Ceremonie', text: 'Het jawoord op het strand', icon: 'rings', photo: 'assets/sfeer-ceremonie.jpg', dagOnly: true },
    { time: '16:00', title: 'Toost & borrel', text: 'Proosten, felicitaties en een borrel aan zee', icon: 'cake', photo: 'assets/sfeer-vuurkorf.jpg', dagOnly: true },
    { time: '18:00', title: 'Walking dinner', text: 'Proeven en bijpraten, met live cooking', icon: 'dinner', photo: 'assets/sfeer-lampions.jpg', dagOnly: true },
    { time: '20:15', title: 'Avondfeest', text: 'Om 20:45 de openingsdans, daarna dansen tot middernacht', icon: 'music', photo: 'assets/sfeer-avondfeest.jpg' },
    { time: '24:00', title: 'Einde', text: 'Tijd om naar huis te gaan', icon: 'moon', photo: 'assets/sfeer-zonsondergang.jpg' },
  ],

  // Onze happy moments: polaroids met een handgeschreven onderschrift.
  // `position` bepaalt welk deel van de foto zichtbaar blijft (zoals CSS object-position).
  // Hoe het begon: twee profielkaartjes om naar rechts te swipen, daarna "It's a match!".
  match: {
    intro: 'Hieronder zie je hoe wij begonnen. Swipe, swipe. Doe het ons maar na!',
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
        bio: 'Zonnebril op, voeten in het zand, een drankje bij zonsondergang: mijn ideale avond. Zoekt iemand die daar net zo blij van wordt en daarna nog wil dansen.',
      },
    ],
    since: 'Actief in februari 2017',
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
    text: 'Begin februari 2017 swipeten we allebei naar rechts. De rest is geschiedenis.',
  },

  moments: {
    title: 'Onze happy moments',
    intro: 'Van festivalweide tot strand, van scooter tot theaterstoel: een greep uit onze mooiste momenten samen. Op 25 juni komt daar de allermooiste bij.',
    items: [
      { src: 'assets/moment-strand.jpg', caption: 'Wind in de haren', position: '50% 40%' },
      { src: 'assets/moment-scooter.jpg', caption: 'Samen op de scooter', position: '50% 45%' },
      { src: 'assets/moment-festival.jpg', caption: 'Festivalliefde', position: '50% 35%' },
      { src: 'assets/moment-boot.jpg', caption: 'Op het water', position: '48% 48%', zoom: 1.5 },
      { src: 'assets/moment-ei.jpg', caption: 'Gewoon even gek doen', position: '50% 50%' },
      { src: 'assets/moment-herfst.jpg', caption: 'Herfstkus', position: '45% 45%' },
      { src: 'assets/moment-feest.jpg', caption: 'Dansen tot het licht aangaat', position: '50% 55%' },
      { src: 'assets/moment-theater.jpg', caption: 'Avondje uit', position: '50% 45%' },
      { src: 'assets/moment-avond.jpg', caption: 'Nog één liedje', position: '50% 55%' },
    ],
  },

  dresscode: {
    title: 'Summer chic',
    text: 'Denk aan luchtige stoffen en zachte zomerse tinten. We vieren aan zee: houd rekening met zand onder je voeten en neem voor de avond iets warms mee.',
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
      a: 'Hoe leuk we de kleintjes ook vinden, we maken er een feest voor volwassenen van. Kinderen uit de familie zijn wel welkom: zij staan dan bij naam op de uitnodiging.',
    },
    { q: 'Mag ik iemand meenemen?', a: 'Als je een introducé mag meenemen, zie je dat terug in het RSVP-formulier.' },
    { q: 'Hoe zit het met parkeren?', a: 'Informatie over parkeren en bereikbaarheid volgt.' }, // TODO
    { q: 'Hebben jullie een cadeautip?', a: 'Informatie volgt.' }, // TODO
    { q: 'Waar kan ik overnachten?', a: 'Informatie volgt.' }, // TODO
    { q: 'Ik wil iets voorbereiden. Bij wie kan ik terecht?', a: 'De contactgegevens van onze ceremoniemeester volgen.' }, // TODO
  ],
};
