import type { NotificationLocale } from '../externalNotifications/types';

const cs: NotificationLocale = {
  email: {
    footer: 'Toto jsi obdržel/a, protože máš povoleny upozornění v TREK FAMILY.',
    manage: 'Spravovat předvolby v nastavení',
    madeWith: 'Made with',
    openTrek: 'Otevřít TREK FAMILY',
  },
  events: {
    trip_invite: (p) => ({
      title: `Pozvánka do "${p.trip}"`,
      body: `${p.actor} pozval ${p.invitee || 'člena'} na výlet "${p.trip}".`,
    }),
    booking_change: (p) => ({
      title: `Nová rezervace: ${p.booking}`,
      body: `${p.actor} přidal rezervaci "${p.booking}" (${p.type}) k "${p.trip}".`,
    }),
    trip_reminder: (p) => ({
      title: `Připomínka výletu: ${p.trip}`,
      body: `Váš výlet "${p.trip}" se blíží!`,
    }),
    todo_due: (p) => ({
      title: `Úkol se blíží: ${p.todo}`,
      body: `"${p.todo}" ve výletě "${p.trip}" má termín ${p.due}.`,
    }),
    document_expiry: (p) => ({
      title: `Dokument brzy vyprší: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}${p.documentType} pro "${p.trip}" vyprší dne ${p.expiry}.`,
    }),
    age_band_update: (p) => ({
      title: `Cestující možná přešel do nové věkové skupiny: ${p.traveler}`,
      body: `${p.traveler} je nyní dost starý/á na to, aby byl/a ${p.newType} místo ${p.oldType}. Pokud je to správně, aktualizujte v Nastavení.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Chybějící rezervace dopravy: ${p.trip}`,
      body: `${p.travelers} možná ještě nemá zarezervovanou dopravu na "${p.trip}".`,
    }),
    vacay_invite: (p) => ({
      title: 'Pozvánka Vacay Fusion',
      body: `${p.actor} vás pozval ke spojení dovolenkových plánů. Otevřete TREK FAMILY pro přijetí nebo odmítnutí.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} sdílených fotek`,
      body: `${p.actor} sdílel ${p.count} foto v "${p.trip}".`,
    }),
    collab_message: (p) => ({
      title: `Nová zpráva v "${p.trip}"`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Balení: ${p.category}`,
      body: `${p.actor} vás přiřadil do kategorie "${p.category}" v "${p.trip}".`,
    }),
    version_available: (p) => ({
      title: 'Nová verze TREK dostupná',
      body: `TREK ${p.version} je nyní dostupný. Navštivte administrátorský panel pro aktualizaci.`,
    }),
    synology_session_cleared: () => ({
      title: 'Relace Synology byla zrušena',
      body: 'Váš účet nebo URL Synology se změnil. Byli jste odhlášeni ze Synology Photos.',
    }),
  },
  passwordReset: {
    subject: 'Obnovení hesla',
    greeting: 'Ahoj',
    body: 'Obdrželi jsme žádost o obnovení hesla k tvému účtu TREK FAMILY. Klikni na tlačítko níže a nastav nové heslo.',
    ctaIntro: 'Obnovit heslo',
    expiry: 'Odkaz vyprší za 60 minut.',
    ignore: 'Pokud jsi o obnovení nežádal/a, tento e-mail ignoruj — heslo zůstane beze změny.',
  },
};

export default cs;
