import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardCheck,
  Trophy,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import './clinic.css'

const clinicCopy = {
  th: {
    home: 'หน้าหลัก Success Padel', imageAlt: 'ผู้เล่นสี่คนฝึกพาเดลกับโค้ช',
    eyebrow: 'คลินิกพิเศษสำหรับผู้เล่นมือใหม่',
    headline: 'พัฒนาฝีมือให้พร้อม', headlineAccent: 'สำหรับการแข่งขันครั้งต่อไป',
    lead: 'ฝึกเทคนิค เพิ่มความมั่นใจ และพัฒนาทักษะไปพร้อมกับผู้เล่นในระดับเดียวกัน',
    specialPrice: 'ราคาพิเศษ', price: '2,000 บาท', priceUnit: 'ต่อกลุ่ม / ครั้ง',
    included: 'รวมค่าสนาม Covered Court และค่าโค้ชแล้ว',
    conditionsLabel: 'เงื่อนไขการเข้าร่วม', conditionsTitle: 'มาเป็นทีม แล้วพัฒนาไปด้วยกัน',
    conditions: [
      ['เคยร่วมการแข่งขัน', 'สำหรับผู้เล่นทัวร์นาเมนต์ของ Success Padel'],
      ['รวมทีมมา 4 คน', 'จัดกลุ่มผู้เรียนมาเองให้ครบทีม'],
      ['Level เดียวกัน', 'ทุกคนในกลุ่มอยู่ในระดับเดียวกัน'],
      ['เลือกโค้ชได้', 'เลือกเรียนกับโค้ชที่คุณต้องการ'],
    ],
    ready: 'พร้อมพัฒนาฝีมือไปอีกขั้นหรือยัง?', bookingTitle: 'เลือกวัน เวลา และโค้ชของคุณ',
    bookingDetail: 'แจ้งพนักงานเพื่อประสานงานและนัดหมายคลาส', bookingAction: 'ติดต่อพนักงานเพื่อจองคลาส',
  },
  en: {
    home: 'Success Padel home', imageAlt: 'Four players training on a padel court with their coach',
    eyebrow: 'A special clinic for developing players',
    headline: 'Build your game.', headlineAccent: 'Be ready for your next competition.',
    lead: 'Improve your technique and confidence alongside players at the same level.',
    specialPrice: 'Special price', price: '2,000 THB', priceUnit: 'per group / session',
    included: 'Covered Court hire and your coach are included',
    conditionsLabel: 'Who can join', conditionsTitle: 'Come as a team. Improve together.',
    conditions: [
      ['Competition players', 'For players who have joined a Success Padel tournament'],
      ['Bring a group of 4', 'Form your own complete training group'],
      ['One shared level', 'Everyone in the group plays at the same level'],
      ['Choose your coach', 'Train with the coach your group wants'],
    ],
    ready: 'Ready to take your game further?', bookingTitle: 'Choose your date, time and coach',
    bookingDetail: 'Ask the club team to coordinate and confirm your clinic.', bookingAction: 'Contact the team to book',
  },
} as const

const conditionIcons = [Trophy, UsersRound, ClipboardCheck, UserRoundCheck]

export default function ClinicPage() {
  const [language, setLanguage] = useState<'th' | 'en'>(() => {
    try { return localStorage.getItem('clinic-language') === 'en' ? 'en' : 'th' } catch { return 'th' }
  })
  const copy = clinicCopy[language]
  const chooseLanguage = (nextLanguage: 'th' | 'en') => {
    setLanguage(nextLanguage)
    try { localStorage.setItem('clinic-language', nextLanguage) } catch { /* Storage may be unavailable. */ }
  }

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Success Padel Clinic'
    return () => { document.title = previousTitle }
  }, [])

  return (
    <main className="clinic-offer">
      <section className="clinic-offer__sheet">
        <header className="clinic-offer__topbar">
          <Link to="/competitive" aria-label={copy.home}>
            <img src="/brand/logo-padel.webp" alt="Success Padel Samui" />
          </Link>
          <div className="clinic-offer__top-actions">
            <span>SUCCESS PADEL CLINIC</span>
            <nav className="clinic-offer__language" aria-label="Language / ภาษา">
              <button type="button" lang="th" aria-pressed={language === 'th'} onClick={() => chooseLanguage('th')}>ไทย</button>
              <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => chooseLanguage('en')}>English</button>
            </nav>
          </div>
        </header>

        <section className="clinic-offer__hero">
          <div className="clinic-offer__hero-copy">
            <p className="clinic-offer__eyebrow">{copy.eyebrow}</p>
            <h1>{copy.headline}<br /><em>{copy.headlineAccent}</em></h1>
            <p className="clinic-offer__lead">{copy.lead}</p>
          </div>
          <figure className="clinic-offer__visual">
            <img
              src="/coaching/group-clinic-minimal.png"
              alt={copy.imageAlt}
            />
          </figure>
        </section>

        <section className="clinic-offer__price" aria-label="ราคาคลินิก">
          <div>
            <CircleDollarSign aria-hidden="true" />
            <p><span>{copy.specialPrice}</span><strong>{copy.price}</strong><small>{copy.priceUnit}</small></p>
          </div>
          <p><BadgeCheck aria-hidden="true" /> {copy.included}</p>
        </section>

        <section className="clinic-offer__conditions" aria-labelledby="clinic-conditions-title">
          <div className="clinic-offer__section-title">
            <p>{copy.conditionsLabel}</p>
            <h2 id="clinic-conditions-title">{copy.conditionsTitle}</h2>
          </div>
          <div className="clinic-offer__condition-grid">
            {copy.conditions.map(([title, detail], index) => {
              const Icon = conditionIcons[index]
              return <article key={title}>
                <Icon aria-hidden="true" />
                <div><strong>{title}</strong><span>{detail}</span></div>
              </article>
            })}
          </div>
        </section>

        <section className="clinic-offer__booking" aria-labelledby="clinic-booking-title">
          <CalendarCheck2 aria-hidden="true" />
          <div>
            <p>{copy.ready}</p>
            <h2 id="clinic-booking-title">{copy.bookingTitle}</h2>
            <span>{copy.bookingDetail}</span>
          </div>
          <strong>{copy.bookingAction}</strong>
        </section>
      </section>
    </main>
  )
}
