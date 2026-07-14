import type { NotificationLocale } from '../externalNotifications/types';

const id: NotificationLocale = {
  email: {
    footer: 'Anda menerima ini karena Anda telah mengaktifkan notifikasi di TREK FAMILY.',
    manage: 'Kelola preferensi di Pengaturan',
    madeWith: 'Dibuat dengan',
    openTrek: 'Buka TREK FAMILY',
  },
  events: {
    trip_invite: (p) => ({
      title: `Undangan perjalanan: "${p.trip}"`,
      body: `${p.actor} mengundang ${p.invitee || 'seorang anggota'} ke perjalanan "${p.trip}".`,
    }),
    booking_change: (p) => ({
      title: `Pemesanan baru: ${p.booking}`,
      body: `${p.actor} menambahkan "${p.booking}" (${p.type}) baru ke "${p.trip}".`,
    }),
    trip_reminder: (p) => ({
      title: `Pengingat perjalanan: ${p.trip}`,
      body: `Perjalanan Anda "${p.trip}" akan segera tiba!`,
    }),
    todo_due: (p) => ({
      title: `Tugas jatuh tempo: ${p.todo}`,
      body: `"${p.todo}" di "${p.trip}" jatuh tempo pada ${p.due}.`,
    }),
    document_expiry: (p) => ({
      title: `Dokumen akan segera kedaluwarsa: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}${p.documentType} untuk "${p.trip}" kedaluwarsa pada ${p.expiry}.`,
    }),
    age_band_update: (p) => ({
      title: `Traveler mungkin telah memasuki kelompok usia baru: ${p.traveler}`,
      body: `${p.traveler} sekarang cukup umur untuk menjadi ${p.newType}, bukan ${p.oldType}. Perbarui di Pengaturan jika benar.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Reservasi transportasi belum ada: ${p.trip}`,
      body: `${p.travelers} mungkin belum memiliki transportasi yang dipesan untuk "${p.trip}".`,
    }),
    vacay_invite: (p) => ({
      title: 'Undangan Penggabungan Vacay',
      body: `${p.actor} mengundang Anda untuk menggabungkan rencana liburan. Buka TREK FAMILY untuk menerima atau menolak.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} foto dibagikan`,
      body: `${p.actor} membagikan ${p.count} foto di "${p.trip}".`,
    }),
    collab_message: (p) => ({
      title: `Pesan baru di "${p.trip}"`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Pengepakan: ${p.category}`,
      body: `${p.actor} menugaskan Anda ke kategori "${p.category}" di "${p.trip}".`,
    }),
    version_available: (p) => ({
      title: 'Versi TREK baru tersedia',
      body: `TREK ${p.version} sekarang tersedia. Kunjungi panel admin untuk memperbarui.`,
    }),
    synology_session_cleared: () => ({
      title: 'Sesi Synology dihapus',
      body: 'Akun atau URL Synology Anda berubah. Anda telah keluar dari Synology Photos.',
    }),
  },
  passwordReset: {
    subject: 'Setel ulang kata sandi Anda',
    greeting: 'Halo',
    body: 'Kami menerima permintaan untuk menyetel ulang kata sandi akun TREK FAMILY Anda. Klik tombol di bawah untuk menetapkan kata sandi baru.',
    ctaIntro: 'Setel ulang kata sandi',
    expiry: 'Tautan ini kedaluwarsa dalam 60 menit.',
    ignore: 'Jika Anda tidak meminta ini, Anda dapat mengabaikan email ini — kata sandi Anda tidak akan berubah.',
  },
};

export default id;
