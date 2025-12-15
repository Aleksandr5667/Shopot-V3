import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en";
import ru from "./locales/ru";

const LANGUAGE_KEY = "@shepot_language";

export const getStoredLanguage = async (): Promise<string> => {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    return lang || "en";
  } catch {
    return "en";
  }
};

export const setStoredLanguage = async (lang: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch (error) {
    console.error("Failed to save language preference:", error);
  }
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export const changeLanguage = async (lang: string): Promise<void> => {
  await i18n.changeLanguage(lang);
  await setStoredLanguage(lang);
};

export default i18n;
