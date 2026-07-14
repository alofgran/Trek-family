import type { NotificationLocale } from '../externalNotifications/types';

const tr: NotificationLocale = {
  email: {
    footer: "TREK FAMILY'te bildirimleri etkinleştirdiğiniz için bunu aldınız.",
    manage: 'Ayarlarda tercihleri yönetin',
    madeWith: 'Made with',
    openTrek: "TREK FAMILY'i aç",
  },
  events: {
    trip_invite: (p) => ({
      title: `"${p.trip}" seyahatine davet`,
      body: `${p.actor}, ${p.invitee || 'bir üyeyi'} "${p.trip}" seyahatine davet etti.`,
    }),
    booking_change: (p) => ({
      title: `Yeni rezervasyon: ${p.booking}`,
      body: `${p.actor}, "${p.trip}" seyahatine "${p.booking}" (${p.type}) rezervasyonu ekledi.`,
    }),
    trip_reminder: (p) => ({
      title: `Seyahat hatırlatıcısı: ${p.trip}`,
      body: `"${p.trip}" seyahatiniz yaklaşıyor!`,
    }),
    todo_due: (p) => ({
      title: `Görev süresi dolmak üzere: ${p.todo}`,
      body: `"${p.trip}" içindeki "${p.todo}" görevi ${p.due} tarihinde bitiyor.`,
    }),
    document_expiry: (p) => ({
      title: `Belge süresi dolmak üzere: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}"${p.trip}" için ${p.documentType} belgesi ${p.expiry} tarihinde sona eriyor.`,
    }),
    age_band_update: (p) => ({
      title: `Yolcu yeni bir yaş grubuna geçmiş olabilir: ${p.traveler}`,
      body: `${p.traveler} artık ${p.oldType} yerine ${p.newType} olacak yaşta. Doğruysa Ayarlar'dan güncelleyin.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Eksik ulaşım rezervasyonu: ${p.trip}`,
      body: `${p.travelers} için "${p.trip}" seyahatinde henüz ulaşım rezervasyonu olmayabilir.`,
    }),
    vacay_invite: (p) => ({
      title: 'Vacay Fusion Daveti',
      body: `${p.actor} sizi tatil planlarını birleştirmeye davet etti. Kabul etmek veya reddetmek için TREK FAMILY'i açın.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} fotoğraf paylaşıldı`,
      body: `${p.actor}, "${p.trip}" içinde ${p.count} fotoğraf paylaştı.`,
    }),
    collab_message: (p) => ({
      title: `"${p.trip}" içinde yeni mesaj`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Bagaj: ${p.category}`,
      body: `${p.actor}, sizi "${p.trip}" içindeki "${p.category}" bagaj kategorisine atadı.`,
    }),
    version_available: (p) => ({
      title: 'Yeni TREK sürümü mevcut',
      body: `TREK ${p.version} artık mevcut. Güncellemek için yönetici panelini ziyaret edin.`,
    }),
    synology_session_cleared: () => ({
      title: 'Synology oturumu temizlendi',
      body: 'Synology hesabınız veya URL değişti. Synology Photos oturumunuz kapatıldı.',
    }),
  },
  passwordReset: {
    subject: 'Şifrenizi sıfırlayın',
    greeting: 'Merhaba',
    body: 'TREK FAMILY hesabınızın şifresini sıfırlamak için bir istek aldık. Yeni bir şifre belirlemek için aşağıdaki butona tıklayın.',
    ctaIntro: 'Şifreyi sıfırla',
    expiry: 'Bu bağlantı 60 dakika içinde sona erer.',
    ignore: 'Bu isteği siz yapmadıysanız, bu e-postayı güvenle yok sayabilirsiniz — şifreniz değişmeyecektir.',
  },
};

export default tr;
