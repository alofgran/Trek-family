import type { NotificationLocale } from '../externalNotifications/types';

const de: NotificationLocale = {
  email: {
    footer: 'Du erhältst diese E-Mail, weil du Benachrichtigungen in TREK FAMILY aktiviert hast.',
    manage: 'Einstellungen verwalten',
    madeWith: 'Made with',
    openTrek: 'TREK FAMILY öffnen',
  },
  events: {
    trip_invite: (p) => ({
      title: `Einladung zu "${p.trip}"`,
      body: `${p.actor} hat ${p.invitee || 'ein Mitglied'} zur Reise "${p.trip}" eingeladen.`,
    }),
    booking_change: (p) => ({
      title: `Neue Buchung: ${p.booking}`,
      body: `${p.actor} hat eine neue Buchung "${p.booking}" (${p.type}) zu "${p.trip}" hinzugefügt.`,
    }),
    trip_reminder: (p) => ({
      title: `Reiseerinnerung: ${p.trip}`,
      body: `Deine Reise "${p.trip}" steht bald an!`,
    }),
    todo_due: (p) => ({
      title: `Aufgabe fällig: ${p.todo}`,
      body: `"${p.todo}" in "${p.trip}" ist am ${p.due} fällig.`,
    }),
    document_expiry: (p) => ({
      title: `Dokument läuft bald ab: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}${p.documentType} für "${p.trip}" läuft am ${p.expiry} ab.`,
    }),
    age_band_update: (p) => ({
      title: `Reisender könnte in neue Altersgruppe gewechselt sein: ${p.traveler}`,
      body: `${p.traveler} ist jetzt alt genug für ${p.newType} statt ${p.oldType}. Bei Bedarf in den Einstellungen aktualisieren.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Fehlende Transportbuchung: ${p.trip}`,
      body: `${p.travelers} haben möglicherweise noch kein Transportmittel für "${p.trip}" gebucht.`,
    }),
    vacay_invite: (p) => ({
      title: 'Vacay Fusion-Einladung',
      body: `${p.actor} hat dich eingeladen, Urlaubspläne zu fusionieren. Öffne TREK FAMILY um anzunehmen oder abzulehnen.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} Fotos geteilt`,
      body: `${p.actor} hat ${p.count} Foto(s) in "${p.trip}" geteilt.`,
    }),
    collab_message: (p) => ({
      title: `Neue Nachricht in "${p.trip}"`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Packliste: ${p.category}`,
      body: `${p.actor} hat dich der Kategorie "${p.category}" in der Packliste von "${p.trip}" zugewiesen.`,
    }),
    version_available: (p) => ({
      title: 'Neue TREK-Version verfügbar',
      body: `TREK ${p.version} ist jetzt verfügbar. Besuche das Admin-Panel zum Aktualisieren.`,
    }),
    synology_session_cleared: () => ({
      title: 'Synology-Sitzung beendet',
      body: 'Dein Synology-Konto oder die URL hat sich geändert. Du wurdest von Synology Photos abgemeldet.',
    }),
  },
  passwordReset: {
    subject: 'Passwort zurücksetzen',
    greeting: 'Hallo',
    body: 'Wir haben eine Anfrage erhalten, das Passwort für dein TREK FAMILY-Konto zurückzusetzen. Klicke auf den Button unten, um ein neues Passwort festzulegen.',
    ctaIntro: 'Passwort zurücksetzen',
    expiry: 'Dieser Link ist 60 Minuten gültig.',
    ignore: 'Wenn du das nicht warst, ignoriere diese E-Mail — dein Passwort bleibt unverändert.',
  },
};

export default de;
