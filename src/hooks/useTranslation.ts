import { useState, useEffect, useCallback } from 'react'
import { t, setLanguage, getLanguage, subscribeToLanguage, Language } from '../i18n'

export function useTranslation() {
  const [language, setLang] = useState<Language>(getLanguage())
  useEffect(() => {
    const unsub = subscribeToLanguage(() => setLang(getLanguage()))
    return unsub
  }, [])
  const changeLanguage = useCallback((lang: Language) => { setLanguage(lang) }, [])
  return { t, language, changeLanguage }
}
