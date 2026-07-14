import type { NotificationLocale } from '../externalNotifications/types';

const gr: NotificationLocale = {
  email: {
    footer: 'Λάβατε αυτό το μήνυμα επειδή έχετε ενεργοποιήσει τις ειδοποιήσεις στο TREK FAMILY.',
    manage: 'Διαχείριση προτιμήσεων στις Ρυθμίσεις',
    madeWith: 'Δημιουργήθηκε με',
    openTrek: 'Άνοιγμα TREK FAMILY',
  },
  events: {
    trip_invite: (p) => ({
      title: `Πρόσκληση ταξιδιού: "${p.trip}"`,
      body: `Ο/Η ${p.actor} προσκάλεσε ${p.invitee || 'ένα μέλος'} στο ταξίδι "${p.trip}".`,
    }),
    booking_change: (p) => ({
      title: `Νέα κράτηση: ${p.booking}`,
      body: `Ο/Η ${p.actor} πρόσθεσε μια νέα κράτηση "${p.booking}" (${p.type}) στο "${p.trip}".`,
    }),
    trip_reminder: (p) => ({
      title: `Υπενθύμιση ταξιδιού: ${p.trip}`,
      body: `Το ταξίδι σας "${p.trip}" πλησιάζει!`,
    }),
    todo_due: (p) => ({
      title: `Εκκρεμότητα προς εκτέλεση: ${p.todo}`,
      body: `Η εκκρεμότητα "${p.todo}" στο "${p.trip}" λήγει στις ${p.due}.`,
    }),
    document_expiry: (p) => ({
      title: `Έγγραφο λήγει σύντομα: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}${p.documentType} για "${p.trip}" λήγει στις ${p.expiry}.`,
    }),
    age_band_update: (p) => ({
      title: `Ο ταξιδιώτης μπορεί να πέρασε σε νέα ηλικιακή ομάδα: ${p.traveler}`,
      body: `${p.traveler} είναι πλέον αρκετά μεγάλος/η ώστε να είναι ${p.newType} αντί για ${p.oldType}. Ενημερώστε στις Ρυθμίσεις αν είναι σωστό.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Λείπει κράτηση μεταφοράς: ${p.trip}`,
      body: `${p.travelers} ενδέχεται να μην έχουν κλείσει ακόμα μεταφορά για "${p.trip}".`,
    }),
    vacay_invite: (p) => ({
      title: 'Πρόσκληση συγχώνευσης διακοπών',
      body: `Ο/Η ${p.actor} σας προσκάλεσε να συγχωνεύσετε τα σχέδια διακοπών σας. Ανοίξτε το TREK FAMILY για να αποδεχτείτε ή να απορρίψετε.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} φωτογραφίες κοινοποιήθηκαν`,
      body: `Ο/Η ${p.actor} κοινοποίησε ${p.count} φωτογραφία/ες στο "${p.trip}".`,
    }),
    collab_message: (p) => ({
      title: `Νέο μήνυμα στο "${p.trip}"`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Λίστα συσκευασίας: ${p.category}`,
      body: `Ο/Η ${p.actor} σας ανέθεσε στην κατηγορία "${p.category}" της λίστας συσκευασίας στο "${p.trip}".`,
    }),
    version_available: (p) => ({
      title: 'Νέα έκδοση TREK διαθέσιμη',
      body: `Η έκδοση TREK ${p.version} είναι τώρα διαθέσιμη. Επισκεφθείτε τον πίνακα διαχείρισης για να ενημερώσετε.`,
    }),
    synology_session_cleared: () => ({
      title: 'Η σύνδεση Synology τερματίστηκε',
      body: 'Ο λογαριασμός σας Synology ή το URL άλλαξε. Έχετε αποσυνδεθεί από το Synology Photos.',
    }),
  },
  passwordReset: {
    subject: 'Επαναφορά κωδικού πρόσβασης',
    greeting: 'Γεια σας',
    body: 'Λάβαμε ένα αίτημα επαναφοράς του κωδικού πρόσβασης για τον λογαριασμό σας στο TREK FAMILY. Κάντε κλικ στο παρακάτω κουμπί για να ορίσετε νέο κωδικό πρόσβασης.',
    ctaIntro: 'Επαναφορά κωδικού',
    expiry: 'Αυτός ο σύνδεσμος λήγει σε 60 λεπτά.',
    ignore: 'Εάν δεν ζητήσατε αυτή την αλλαγή, μπορείτε να αγνοήσετε αυτό το μήνυμα — ο κωδικός σας δεν θα αλλάξει.',
  },
};

export default gr;
