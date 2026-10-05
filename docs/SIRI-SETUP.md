# Добавление расходов через Siri

Проверено на iPhone с английским интерфейсом Shortcuts и русской Siri Classic.
Инструкция также доступна в приложении: **Аккаунт → Siri tokens → Как создать команду Siri**.

## Создание команды

Создайте личный токен в аккаунте приложения и скопируйте его. Токен показывается
один раз. Не публикуйте команду с настоящим токеном; для другого устройства создайте
отдельный токен.

В Shortcuts создайте новую пустую команду. Добавьте действия в таком порядке:

| Действие (искать на английском) | Что выбрать |
| --- | --- |
| URL | `https://family-budget-app-pi.vercel.app/api/shortcut/expense` |
| Dictate Text | Language → Russian (Russia); Stop Listening → After Pause |
| Date | Current Date |
| Format Date | На входе переменная из Date. Date Format → Custom. Format String → `yyyyMMddHHmmssSSS` |
| Get Contents of URL | На входе **переменная URL из первого действия**. Method → POST |
| Get Dictionary Value | Key → `message`; Dictionary → переменная Contents of URL |
| Speak Text | Переменная Dictionary Value; язык Russian |

У Get Contents of URL раскройте Headers. Добавьте `Authorization` со значением
`Bearer YOUR_PERSONAL_TOKEN`: один обычный пробел после Bearer, без кавычек и
переносов строк. Вставьте свой токен вместо `YOUR_PERSONAL_TOKEN`.

В Request Body выберите JSON. Добавьте три поля типа Text:

| Ключ (регистр важен) | Значение |
| --- | --- |
| `text` | Переменная Dictated Text |
| `timeZone` | Обычный текст `Asia/Jerusalem` |
| `requestId` | Переменная Formatted Date |

Shortcuts формирует JSON и его Content-Type. Отдельный заголовок Content-Type
не понадобился в проверенной команде. В поездке измените timeZone на свой пояс IANA.

Названия переменных выбирайте через Select Variable, не печатайте их вручную.
Особенно проверьте, что Format Date получает дату, а Get Contents of URL — URL,
даже если Shortcuts автоматически предложил результат соседнего действия.
[Пользовательские форматы даты — Apple](https://support.apple.com/en-euro/guide/shortcuts/apd8d9b19184/ios).

`Get Dictionary Value` извлекает текст ответа из поля `message`.
[Описание действия — Apple](https://support.apple.com/en-ke/guide/shortcuts/apdf01294032/ios).

## Запуск голосом

Назовите команду на языке Siri. Для русской Siri — «Трата».
Скажите «Привет, Siri, Трата», дождитесь начала диктовки, затем назовите расход.
Например: «Продукты в Шуферсале 187 шекелей».

Если включена Siri AI и русский не поддерживается, на версиях iOS с выбором
Siri Classic: Settings → Siri → Turn Off Siri → Turn On Siri → Use Siri Classic,
затем Language → Russian. Это переключение Siri, не переустановка iOS.
[Переключение на Siri Classic — Apple](https://support.apple.com/guide/iphone/turn-restrict-access-apple-intelligence-iph3fed3f2c3/27/ios/27).

Успешный ответ означает реальную запись в «Тратах» и карточку «Через Siri» в чате.
Если категория не найдена, расход не сохраняется: добавьте/активируйте нужную
категорию в приложении или явно назовите существующую, затем продиктуйте заново.

## Сетевая ошибка и повтор

Каждый полный запуск этой простой команды генерирует новый requestId. **Это не
автоматическая защита от дубля при полном перезапуске после ошибки сети.**

После обрыва сначала откройте «Траты» и проверьте результат. Если запись есть,
повторять не нужно. Если результат неизвестен, безопасный повтор возможен только
с прежними `text`, `timeZone` и `requestId`. Если сохранили исходные значения,
подставьте их обычным текстом во временной копии команды вместо переменных.
Если исходный requestId не сохранили, не считайте полный перезапуск безопасным
повтором: он может создать ещё один расход.

Ответ `category_required` / `clarification_required` подтверждает, что расход
не сохранён. После уточнения фразы или добавления категории используйте новый запуск
с новым requestId. Отмена/удаление уже сохранённого расхода не освобождает его
старый requestId для новой записи.

## Проверка соединения без расходов

Для проверки создайте **новую** команду из трёх действий:
URL → Get Contents of URL → Quick Look. URL:
`https://family-budget-app-pi.vercel.app/api/shortcut/check`.
Начните с GET без Headers, затем POST с пустым JSON. Ожидается `Connection works`.
В нашем случае новая команда устранила ошибку сети; точная причина сбоя старой
команды не установлена.

Если проверка работает, поменяйте адрес на `/api/shortcut/expense`: без токена
ожидается `unauthorized`. Затем добавьте Authorization: с пустым телом ожидается
`invalid_request`. Только после этого добавляйте поля расхода. Quick Look можно
временно использовать вместо голосового ответа для просмотра полного JSON.
