'use client';

import Link from 'next/link';
import { useAppSelector } from '@/store/store';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/shared/config/support';

export default function PrivacyPage() {
  const ru = useAppSelector(s => s.ui.language) === 'ru';
  const sections = ru ? [
    ['Какие данные используются', 'Family Budget хранит данные аккаунта (email, имя и настройки), введённые расходы, доходы, категории, цели, регулярные платежи, сообщения чата и сведения об участии в семье. Эти данные нужны для работы приложения и синхронизации между устройствами.'],
    ['Семейный доступ', 'Участники вашей семьи могут видеть общие записи и цели. Приватные записи предназначены только для владельца. Не добавляйте в общие записи сведения, которые не хотите показывать другим участникам.'],
    ['Обработка текста с помощью ИИ', 'Для распознавания расходов текст сообщения, список активных категорий, валюта, язык и текущая дата передаются Groq через сервер приложения. Это относится и к приватным расходам, введённым через чат или Siri. Для ввода без распознавания текста используйте ручную форму. Не отправляйте пароли, номера банковских карт или другие секреты в чат.'],
    ['Фото чеков', 'Если вы отправляете фото чека, приложение уменьшает его на устройстве и передаёт Groq через сервер вместе со списком активных категорий, валютой, языком и датой. Само фото не сохраняется ни в приложении, ни в нашей базе — хранится только то, что вы сохранили как расход. На чеке могут быть последние цифры карты и название магазина: если не хотите их передавать, введите расход текстом или вручную.'],
    ['Сервисы и данные на устройстве', 'Firebase используется для входа и хранения данных; Vercel — для размещения приложения и серверных запросов. При включённом мониторинге Sentry получает технические сведения об ошибках. Браузер хранит сессию, настройки и кеш PWA. Провайдеры могут обрабатывать данные за пределами вашей страны.'],
    ['Хранение, экспорт и удаление', 'Данные хранятся, пока вы пользуетесь аккаунтом, либо до запроса на удаление. В настройках аккаунта можно экспортировать данные и удалить аккаунт со всеми связанными данными (потребуется заново подтвердить вход). Если сделать это в приложении не получается, напишите на контакт ниже с адреса, используемого для входа. Мы можем запросить подтверждение владения аккаунтом. Не присылайте пароль.'],
  ] : [
    ['Data we use', 'Family Budget stores account details (email, name and preferences), expenses, income, categories, goals, recurring payments, chat messages and family membership. This data supports the app and synchronization between your devices.'],
    ['Family sharing', 'Members of your family can see shared entries and goals. Private entries are intended for their owner only. Do not put information in shared entries that you do not want other members to see.'],
    ['AI text processing', 'To recognize expenses, your message text, active categories, currency, language and current date are sent to Groq through the app server. This also applies to private expenses entered through chat or Siri. Use the manual form to enter data without text recognition. Never send passwords, bank card numbers or other secrets in chat.'],
    ['Receipt photos', 'When you send a receipt photo, the app shrinks it on your device and sends it to Groq through the app server, together with your active categories, currency, language and date. The photo itself is not stored by the app or in our database — only what you save as an expense is kept. A receipt may show the last digits of your card and the shop name; if you prefer not to share them, type the expense or use the manual form.'],
    ['Services and device storage', 'Firebase provides authentication and data storage; Vercel hosts the app and server requests. When error monitoring is enabled, Sentry receives technical error information. Your browser stores your session, preferences and PWA cache. Providers may process data outside your country.'],
    ['Retention, export and deletion', 'Data is retained while you use your account or until you request deletion. In account settings you can export your data and delete your account with all associated data (you will be asked to confirm your sign-in again). If that does not work in the app, email the contact below from your sign-in address. We may ask you to verify account ownership. Never send your password.'],
  ];
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <Link href="/account" className="underline">{ru ? 'В приложение' : 'Open app'}</Link>
      <h1 className="mt-8 text-3xl font-bold">{ru ? 'Приватность и поддержка' : 'Privacy and support'}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{ru ? 'Обновлено: 7 октября 2026' : 'Updated: October 7, 2026'}</p>
      {sections.map(([title, text]) => <section key={title} className="mt-8">
        <h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 leading-relaxed">{text}</p>
      </section>)}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">{ru ? 'Контакт' : 'Contact'}</h2>
        <a className="mt-3 inline-block underline" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
        <p className="mt-4 flex flex-wrap gap-4 text-sm">
          <a className="underline" href="https://firebase.google.com/support/privacy">Firebase</a>
          <a className="underline" href="https://console.groq.com/docs/your-data">Groq</a>
          <a className="underline" href="https://vercel.com/legal/privacy-policy">Vercel</a>
          <a className="underline" href="https://sentry.io/privacy/">Sentry</a>
        </p>
      </section>
    </main>
  );
}
