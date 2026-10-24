import { useState } from 'react'
import { CoachingBooking } from './CoachingBooking'
import { CoachingContent, coachingTranslator } from './CoachingContent'

export default function CoachingPage() {
  const [language, setLanguage] = useState<'en' | 'th'>(() => { try { return localStorage.getItem('coaching-language') === 'th' ? 'th' : 'en' } catch { return 'en' } })
  const chooseLanguage = (value: 'en' | 'th') => { setLanguage(value); try { localStorage.setItem('coaching-language', value) } catch { /* Storage may be unavailable. */ } }
  return <CoachingContent language={language} chooseLanguage={chooseLanguage} booking={<CoachingBooking t={coachingTranslator(language)} language={language}/>}/>
}
