import i18next from 'i18next'
import en from '../locales/en.json'

export async function initializeMainI18n(): Promise<void> {
  if (i18next.isInitialized) {
    return
  }

  await i18next.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: { translation: en }
    },
    interpolation: {
      escapeValue: false
    }
  })
}

export const t = i18next.t.bind(i18next)
