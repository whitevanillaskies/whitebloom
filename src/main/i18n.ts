import i18next from 'i18next'
import en from '../locales/en.json'
import es from '../locales/es.json'

export async function initializeMainI18n(language: string = 'en'): Promise<void> {
  if (i18next.isInitialized) {
    return
  }

  await i18next.init({
    lng: language,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      es: { translation: es }
    },
    interpolation: {
      escapeValue: false
    }
  })
}

export const t = i18next.t.bind(i18next)
export const changeMainLanguage = async (lang: string): Promise<void> => {
  await i18next.changeLanguage(lang)
}
