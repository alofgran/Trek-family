import type { NotificationLocale } from '../externalNotifications/types';

const ru: NotificationLocale = {
  email: {
    footer: 'Вы получили это, потому что у вас включены уведомления в TREK FAMILY.',
    manage: 'Управление настройками',
    madeWith: 'Made with',
    openTrek: 'Открыть TREK FAMILY',
  },
  events: {
    trip_invite: (p) => ({
      title: `Приглашение в "${p.trip}"`,
      body: `${p.actor} пригласил ${p.invitee || 'участника'} в поездку "${p.trip}".`,
    }),
    booking_change: (p) => ({
      title: `Новое бронирование: ${p.booking}`,
      body: `${p.actor} добавил бронирование "${p.booking}" (${p.type}) в "${p.trip}".`,
    }),
    trip_reminder: (p) => ({
      title: `Напоминание: ${p.trip}`,
      body: `Ваша поездка "${p.trip}" скоро начнётся!`,
    }),
    todo_due: (p) => ({
      title: `Задача к сроку: ${p.todo}`,
      body: `"${p.todo}" в поездке "${p.trip}" — срок ${p.due}.`,
    }),
    document_expiry: (p) => ({
      title: `Документ скоро истекает: ${p.documentType}`,
      body: `${p.traveler ? `(${p.traveler}) ` : ''}${p.documentType} для поездки "${p.trip}" истекает ${p.expiry}.`,
    }),
    age_band_update: (p) => ({
      title: `Путешественник мог перейти в новую возрастную группу: ${p.traveler}`,
      body: `${p.traveler} теперь достаточно взрослый(ая), чтобы быть ${p.newType} вместо ${p.oldType}. Обновите в Настройках, если это верно.`,
    }),
    missing_traveler_transport: (p) => ({
      title: `Отсутствует бронирование транспорта: ${p.trip}`,
      body: `${p.travelers} возможно, ещё не забронировали транспорт для поездки "${p.trip}".`,
    }),
    vacay_invite: (p) => ({
      title: 'Приглашение Vacay Fusion',
      body: `${p.actor} приглашает вас объединить планы отпуска. Откройте TREK FAMILY для подтверждения.`,
    }),
    photos_shared: (p) => ({
      title: `${p.count} фото`,
      body: `${p.actor} поделился ${p.count} фото в "${p.trip}".`,
    }),
    collab_message: (p) => ({
      title: `Новое сообщение в "${p.trip}"`,
      body: `${p.actor}: ${p.preview}`,
    }),
    packing_tagged: (p) => ({
      title: `Список вещей: ${p.category}`,
      body: `${p.actor} назначил вас в категорию "${p.category}" в "${p.trip}".`,
    }),
    version_available: (p) => ({
      title: 'Доступна новая версия TREK',
      body: `TREK ${p.version} теперь доступен. Перейдите в панель администратора для обновления.`,
    }),
    synology_session_cleared: () => ({
      title: 'Сессия Synology сброшена',
      body: 'Ваш аккаунт или URL Synology изменился. Вы вышли из Synology Photos.',
    }),
  },
  passwordReset: {
    subject: 'Сброс пароля',
    greeting: 'Здравствуйте',
    body: 'Мы получили запрос на сброс пароля вашего аккаунта TREK FAMILY. Нажмите кнопку ниже, чтобы установить новый пароль.',
    ctaIntro: 'Сбросить пароль',
    expiry: 'Ссылка действительна 60 минут.',
    ignore: 'Если вы не запрашивали сброс — просто проигнорируйте это письмо, пароль останется прежним.',
  },
};

export default ru;
