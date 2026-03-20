import { useState, useEffect, useCallback } from 'react'
import { t, setLanguage, getLanguage, subscribeToLanguage, Language } from '../i18n'

export function useTranslation() {
  const [language, setLang] = useState<Language>(getLanguage())

  useEffect(() => {
    // Subscribe to language changes from any source
    const unsubscribe = subscribeToLanguage(() => {
      setLang(getLanguage())
    })
    return unsubscribe
  }, [])

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang) // this triggers all subscribers including this hook
  }, [])

  return { t, language, changeLanguage }
}
