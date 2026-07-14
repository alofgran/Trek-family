import type { NotificationLocale } from '../externalNotifications/types';

const pl: NotificationLocale = {
  email: {
    footer: 'Otrzymałeś/aś tę wiadomość, ponieważ masz włączone powiadomienia w TREK FAMILY.',
    manage: 'Zarządzaj preferencjami w ustawieniach',
    madeWith: 'Made with',
    openTrek: 'Otwórz TREK FAMILY',
  },
  events: {
    trip_invite: (p) => ({
      title: `Zaproszenie do "${p.trip}"`,
      body: `${p.actor} zaprosił ${p.invitee || 'członka'} do podróży "${p.trip}".`,
    }),
    booking_change: (p) => ({
      title: `Nowa rezerwacja: ${p.booking}`,
      body: `${p.actor} dodał rezerwację "${p.booking}" (${p.type}) do "${p.trip}".`,
    }),
    trip_reminder: (p) => ({
      title: `Przypomnienie o podróży: ${p.trip}`,
      body: `Twoja podróż "${p.trip}" zbliża się!`,
    }),
    todo_due: (p) => ({
      title: `Zadanie z terminem: ${p.todo}`,
      body: `"${p.todo}" w "${p.trip}" — termin ${p.due}.`,
    }),
    document_expiry: (p) => ({
      title: `Dokument wkrótce wygaśnie: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}${p.documentType} dla "${p.trip}" wygasa ${p.expiry}.`,
    }),
    age_band_update: (p) => ({
      title: `Podróżny mógł przejść do nowej grupy wiekowej: ${p.traveler}`,
      body: `${p.traveler} jest już wystarczająco dorosły/a, aby być ${p.newType} zamiast ${p.oldType}. Zaktualizuj w Ustawieniach, jeśli to prawda.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Brak rezerwacji transportu: ${p.trip}`,
      body: `${p.travelers} może nie mieć jeszcze zarezerwowanego transportu na "${p.trip}".`,
    }),
    vacay_invite: (p) => ({
      title: 'Zaproszenie Vacay Fusion',
      body: `${p.actor} zaprosił Cię do połączenia planów urlopowych. Otwórz TREK FAMILY, aby zaakceptować lub odrzucić.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} zdjęć udostępnionych`,
      body: `${p.actor} udostępnił ${p.count} zdjęcie/zdjęcia w "${p.trip}".`,
    }),
    collab_message: (p) => ({
      title: `Nowa wiadomość w "${p.trip}"`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Pakowanie: ${p.category}`,
      body: `${p.actor} przypisał Cię do kategorii "${p.category}" w "${p.trip}".`,
    }),
    version_available: (p) => ({
      title: 'Nowa wersja TREK dostępna',
      body: `TREK ${p.version} jest teraz dostępny. Odwiedź panel administracyjny, aby zaktualizować.`,
    }),
    synology_session_cleared: () => ({
      title: 'Sesja Synology wyczyszczona',
      body: 'Twoje konto lub URL Synology uległo zmianie. Zostałeś wylogowany z Synology Photos.',
    }),
  },
  passwordReset: {
    subject: 'Zresetuj hasło',
    greeting: 'Cześć',
    body: 'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta TREK FAMILY. Kliknij przycisk poniżej, aby ustawić nowe hasło.',
    ctaIntro: 'Zresetuj hasło',
    expiry: 'Link wygaśnie za 60 minut.',
    ignore: 'Jeśli to nie Ty, zignoruj tę wiadomość — Twoje hasło pozostanie bez zmian.',
  },
};

export default pl;
