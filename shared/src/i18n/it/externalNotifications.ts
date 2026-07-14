import type { NotificationLocale } from '../externalNotifications/types';

const it: NotificationLocale = {
  email: {
    footer: 'Hai ricevuto questa email perché hai le notifiche abilitate in TREK FAMILY.',
    manage: 'Gestisci le preferenze nelle impostazioni',
    madeWith: 'Made with',
    openTrek: 'Apri TREK FAMILY',
  },
  events: {
    trip_invite: (p) => ({
      title: `Invito a "${p.trip}"`,
      body: `${p.actor} ha invitato ${p.invitee || 'un membro'} al viaggio "${p.trip}".`,
    }),
    booking_change: (p) => ({
      title: `Nuova prenotazione: ${p.booking}`,
      body: `${p.actor} ha aggiunto una prenotazione "${p.booking}" (${p.type}) a "${p.trip}".`,
    }),
    trip_reminder: (p) => ({
      title: `Promemoria viaggio: ${p.trip}`,
      body: `Il tuo viaggio "${p.trip}" si avvicina!`,
    }),
    todo_due: (p) => ({
      title: `Attività in scadenza: ${p.todo}`,
      body: `"${p.todo}" in "${p.trip}" scade il ${p.due}.`,
    }),
    document_expiry: (p) => ({
      title: `Documento in scadenza: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}${p.documentType} per "${p.trip}" scade il ${p.expiry}.`,
    }),
    age_band_update: (p) => ({
      title: `Il viaggiatore potrebbe essere passato a una nuova fascia d'età: ${p.traveler}`,
      body: `${p.traveler} ora ha l'età per essere ${p.newType} invece di ${p.oldType}. Aggiorna nelle Impostazioni se corretto.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Prenotazione trasporto mancante: ${p.trip}`,
      body: `${p.travelers} potrebbe non avere ancora un trasporto prenotato per "${p.trip}".`,
    }),
    vacay_invite: (p) => ({
      title: 'Invito Vacay Fusion',
      body: `${p.actor} ti ha invitato a fondere i piani vacanza. Apri TREK FAMILY per accettare o rifiutare.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} foto condivise`,
      body: `${p.actor} ha condiviso ${p.count} foto in "${p.trip}".`,
    }),
    collab_message: (p) => ({
      title: `Nuovo messaggio in "${p.trip}"`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Bagagli: ${p.category}`,
      body: `${p.actor} ti ha assegnato alla categoria "${p.category}" in "${p.trip}".`,
    }),
    version_available: (p) => ({
      title: 'Nuova versione TREK disponibile',
      body: `TREK ${p.version} è ora disponibile. Visita il pannello di amministrazione per aggiornare.`,
    }),
    synology_session_cleared: () => ({
      title: 'Sessione Synology rimossa',
      body: 'Il tuo account o URL Synology è cambiato. Sei stato disconnesso da Synology Photos.',
    }),
  },
  passwordReset: {
    subject: 'Reimposta la tua password',
    greeting: 'Ciao',
    body: 'Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account TREK FAMILY. Clicca il pulsante qui sotto per impostare una nuova password.',
    ctaIntro: 'Reimposta password',
    expiry: 'Questo link scade tra 60 minuti.',
    ignore: 'Se non hai richiesto questa operazione, ignora questa email — la tua password non cambierà.',
  },
};

export default it;
