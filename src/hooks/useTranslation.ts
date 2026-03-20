import { useState, useCallback } from 'react'
import { t, setLanguage, getLanguage, Language } from '../i18n'

export function useTranslation() {
  const [, forceRender] = useState(0)

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang)
    forceRender(n => n + 1)
  }, [])

  return { t, language: getLanguage(), changeLanguage }
}
