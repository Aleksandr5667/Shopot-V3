import React from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { SettingsStackParamList } from "@/navigation/types";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAndroidBottomInset } from "@/hooks/useScreenInsets";

type Props = NativeStackScreenProps<SettingsStackParamList, "Legal">;

export default function LegalScreen({ route }: Props) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { type } = route.params;
  const isRussian = i18n.language === "ru";

  const privacyPolicyRu = `Дата вступления в силу: 9 декабря 2025 года

Настоящая Политика конфиденциальности описывает, как мобильное приложение Shepot (далее — «Приложение», «мы», «нас») собирает, использует и защищает персональные данные пользователей (далее — «вы», «Пользователь»).

1. Какие данные мы собираем

При использовании Приложения мы можем собирать следующие данные:

• Регистрационные данные: адрес электронной почты, имя пользователя, пароль (хранится в зашифрованном виде)
• Данные профиля: имя, фотография профиля (по желанию)
• Сообщения: текстовые сообщения, отправленные через Приложение
• Медиафайлы: фотографии и видео, которые вы отправляете в чатах
• Технические данные: тип устройства, версия операционной системы, уникальный идентификатор устройства для push-уведомлений

2. Как мы используем данные

Собранные данные используются для:

• Предоставления функций обмена сообщениями
• Идентификации пользователей и обеспечения безопасности аккаунта
• Отправки push-уведомлений о новых сообщениях
• Улучшения работы Приложения
• Технической поддержки пользователей

3. Хранение и защита данных

Мы принимаем необходимые меры для защиты ваших персональных данных:

• Пароли хранятся в зашифрованном виде
• Используется защищенное HTTPS-соединение
• Доступ к данным ограничен и контролируется

Данные хранятся на защищенных серверах и не передаются третьим лицам, за исключением случаев, предусмотренных законодательством Российской Федерации.

4. Передача данных третьим лицам

Мы не продаем и не передаем ваши персональные данные третьим лицам в коммерческих целях. Данные могут быть переданы только в следующих случаях:

• По запросу уполномоченных государственных органов в соответствии с законодательством РФ
• Для защиты наших законных прав и интересов

5. Права пользователя

Вы имеете право:

• Получить информацию о хранящихся данных
• Исправить или обновить свои данные
• Удалить свой аккаунт и все связанные данные
• Отозвать согласие на обработку данных

Для реализации своих прав свяжитесь с нами по указанным ниже контактам.

6. Файлы cookie и аналитика

Приложение не использует файлы cookie. Мы можем использовать анонимную аналитику для улучшения работы Приложения.

7. Возрастные ограничения

Приложение предназначено для лиц старше 12 лет. Мы не собираем сознательно данные детей младше этого возраста.

8. Изменения политики

Мы можем обновлять настоящую Политику. При внесении существенных изменений мы уведомим вас через Приложение. Продолжение использования Приложения после изменений означает ваше согласие с обновленной Политикой.

9. Применимое законодательство

Настоящая Политика регулируется законодательством Российской Федерации, включая Федеральный закон «О персональных данных» (152-ФЗ).

10. Контакты

По всем вопросам, связанным с обработкой персональных данных, обращайтесь:
Email: support@shepot.online`;

  const privacyPolicyEn = `Effective Date: December 9, 2025

This Privacy Policy describes how the Shepot mobile application (hereinafter referred to as the "Application", "we", "us") collects, uses, and protects users' personal data (hereinafter referred to as "you", "User").

1. What Data We Collect

When using the Application, we may collect the following data:

• Registration data: email address, username, password (stored in encrypted form)
• Profile data: name, profile photo (optional)
• Messages: text messages sent through the Application
• Media files: photos and videos you send in chats
• Technical data: device type, operating system version, unique device identifier for push notifications

2. How We Use Data

Collected data is used for:

• Providing messaging features
• User identification and account security
• Sending push notifications about new messages
• Improving Application performance
• Technical support for users

3. Data Storage and Protection

We take necessary measures to protect your personal data:

• Passwords are stored in encrypted form
• Secure HTTPS connection is used
• Access to data is limited and controlled

Data is stored on protected servers and is not shared with third parties, except as required by applicable law.

4. Data Sharing with Third Parties

We do not sell or share your personal data with third parties for commercial purposes. Data may only be shared in the following cases:

• Upon request from authorized government bodies in accordance with applicable law
• To protect our legitimate rights and interests

5. User Rights

You have the right to:

• Receive information about stored data
• Correct or update your data
• Delete your account and all associated data
• Withdraw consent for data processing

To exercise your rights, please contact us using the contacts provided below.

6. Cookies and Analytics

The Application does not use cookies. We may use anonymous analytics to improve Application performance.

7. Age Restrictions

The Application is intended for persons over 12 years of age. We do not knowingly collect data from children under this age.

8. Policy Changes

We may update this Policy. If significant changes are made, we will notify you through the Application. Continued use of the Application after changes means your agreement to the updated Policy.

9. Applicable Law

This Policy is governed by the laws of the Russian Federation, including the Federal Law "On Personal Data" (152-FZ).

10. Contacts

For all questions related to personal data processing, please contact:
Email: support@shepot.online`;

  const termsOfUseRu = `Дата вступления в силу: 9 декабря 2025 года

Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует использование мобильного приложения Shepot (далее — «Приложение») и является юридически обязывающим договором между вами (далее — «Пользователь») и разработчиком Приложения (далее — «мы», «Администрация»).

Важно: Используя Приложение, вы подтверждаете, что прочитали, поняли и согласны с условиями настоящего Соглашения. Если вы не согласны с условиями, пожалуйста, не используйте Приложение.

1. Общие положения

1.1. Приложение Shepot — это мессенджер для обмена текстовыми сообщениями и медиафайлами между пользователями.
1.2. Приложение предоставляется «как есть». Администрация не гарантирует бесперебойную работу Приложения.
1.3. Для использования Приложения требуется регистрация с указанием действующего адреса электронной почты.

2. Регистрация и аккаунт

2.1. При регистрации вы обязуетесь предоставить достоверную информацию.
2.2. Вы несете ответственность за сохранность своего пароля и за все действия, совершенные под вашим аккаунтом.
2.3. Один пользователь может иметь только один аккаунт.
2.4. Запрещается передавать доступ к аккаунту третьим лицам.

3. Правила использования

При использовании Приложения запрещается:

• Распространять спам, рекламу, вредоносные ссылки
• Публиковать незаконный контент, включая материалы экстремистского характера
• Оскорблять, угрожать или преследовать других пользователей
• Распространять персональные данные других лиц без их согласия
• Использовать Приложение для мошенничества или иной незаконной деятельности
• Пытаться получить несанкционированный доступ к системе
• Распространять материалы, нарушающие авторские права
• Создавать поддельные аккаунты или выдавать себя за других лиц

4. Контент пользователей

4.1. Вы несете полную ответственность за контент, который отправляете через Приложение.
4.2. Отправляя контент, вы подтверждаете, что имеете все необходимые права на его распространение.
4.3. Администрация не модерирует частную переписку, но оставляет за собой право удалять контент, нарушающий законодательство РФ, по запросу уполномоченных органов.

5. Конфиденциальность

5.1. Обработка персональных данных осуществляется в соответствии с Политикой конфиденциальности.
5.2. Используя Приложение, вы даете согласие на обработку ваших персональных данных в соответствии с Политикой конфиденциальности.

6. Интеллектуальная собственность

6.1. Приложение и все его компоненты (дизайн, код, логотипы) являются объектами интеллектуальной собственности Администрации.
6.2. Запрещается копировать, модифицировать или распространять Приложение без письменного согласия Администрации.

7. Ограничение ответственности

7.1. Администрация не несет ответственности за:

• Контент, созданный и распространяемый пользователями
• Временную недоступность Приложения
• Потерю данных по причинам, не зависящим от Администрации
• Действия третьих лиц

7.2. Максимальная ответственность Администрации ограничивается стоимостью услуг, оплаченных Пользователем (если применимо).

8. Блокировка и удаление аккаунта

8.1. Администрация вправе заблокировать или удалить аккаунт Пользователя в случае нарушения условий настоящего Соглашения.
8.2. Пользователь может удалить свой аккаунт в любое время через настройки Приложения или обратившись в поддержку.

9. Изменения Соглашения

9.1. Администрация вправе изменять условия настоящего Соглашения.
9.2. Продолжение использования Приложения после внесения изменений означает ваше согласие с новыми условиями.

10. Применимое право

10.1. Настоящее Соглашение регулируется законодательством Российской Федерации.
10.2. Все споры разрешаются путем переговоров, а при недостижении согласия — в судебном порядке по месту нахождения Администрации.

11. Контакты

По всем вопросам обращайтесь:
Email: support@shepot.online`;

  const termsOfUseEn = `Effective Date: December 9, 2025

This User Agreement (hereinafter referred to as the "Agreement") governs the use of the Shepot mobile application (hereinafter referred to as the "Application") and is a legally binding contract between you (hereinafter referred to as the "User") and the developer of the Application (hereinafter referred to as "we", "Administration").

Important: By using the Application, you confirm that you have read, understood, and agree to the terms of this Agreement. If you do not agree to the terms, please do not use the Application.

1. General Provisions

1.1. The Shepot Application is a messenger for exchanging text messages and media files between users.
1.2. The Application is provided "as is". The Administration does not guarantee uninterrupted operation of the Application.
1.3. Registration with a valid email address is required to use the Application.

2. Registration and Account

2.1. When registering, you agree to provide accurate information.
2.2. You are responsible for keeping your password secure and for all actions performed under your account.
2.3. One user may have only one account.
2.4. It is prohibited to transfer access to your account to third parties.

3. Usage Rules

When using the Application, it is prohibited to:

• Distribute spam, advertising, malicious links
• Post illegal content, including extremist materials
• Insult, threaten, or harass other users
• Distribute personal data of other persons without their consent
• Use the Application for fraud or other illegal activities
• Attempt to gain unauthorized access to the system
• Distribute materials that infringe copyrights
• Create fake accounts or impersonate other persons

4. User Content

4.1. You are fully responsible for the content you send through the Application.
4.2. By sending content, you confirm that you have all necessary rights to distribute it.
4.3. The Administration does not moderate private correspondence but reserves the right to remove content that violates applicable law upon request from authorized bodies.

5. Privacy

5.1. Processing of personal data is carried out in accordance with the Privacy Policy.
5.2. By using the Application, you consent to the processing of your personal data in accordance with the Privacy Policy.

6. Intellectual Property

6.1. The Application and all its components (design, code, logos) are intellectual property of the Administration.
6.2. It is prohibited to copy, modify, or distribute the Application without written consent of the Administration.

7. Limitation of Liability

7.1. The Administration is not responsible for:

• Content created and distributed by users
• Temporary unavailability of the Application
• Loss of data due to reasons beyond the Administration's control
• Actions of third parties

7.2. The maximum liability of the Administration is limited to the cost of services paid by the User (if applicable).

8. Account Blocking and Deletion

8.1. The Administration reserves the right to block or delete a User's account in case of violation of the terms of this Agreement.
8.2. The User may delete their account at any time through the Application settings or by contacting support.

9. Agreement Changes

9.1. The Administration reserves the right to change the terms of this Agreement.
9.2. Continued use of the Application after changes means your agreement to the new terms.

10. Applicable Law

10.1. This Agreement is governed by the laws of the Russian Federation.
10.2. All disputes are resolved through negotiations, and if agreement cannot be reached, through the courts at the location of the Administration.

11. Contacts

For all questions, please contact:
Email: support@shepot.online`;

  const getContent = () => {
    if (type === "privacy") {
      return isRussian ? privacyPolicyRu : privacyPolicyEn;
    }
    return isRussian ? termsOfUseRu : termsOfUseEn;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: getAndroidBottomInset(insets.bottom) + Spacing.xl },
      ]}
    >
      <ThemedText style={styles.text}>{getContent()}</ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
  },
});
