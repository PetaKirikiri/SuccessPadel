import { useState } from 'react'
import thai from './th.json'
import { Link } from 'react-router-dom'
import { Sprout, Target, Trophy, Clock3, Users, Coins, CalendarDays, MapPin, Layers, Shield, Network, MessageCircle, Swords, Hand, Move, BookOpen, Repeat2, RotateCcw, Footprints, ArrowUpRight, MessagesSquare, ShieldCheck, ClipboardCheck, Dumbbell } from 'lucide-react'
import './coaching.css'

const levels = [
  { number: '01', title: 'Beginner', subtitle: 'PLAY WITH CONFIDENCE', Icon: Sprout, price: '500 THB', duration: '60 minutes', label: 'FIRST TRIAL', items: ['Grip & basic positioning', 'Forehand, backhand & serving', 'Basic rules and confidence on court'], note: 'Build the basics, at your pace.' },
  { number: '02', title: 'Skill Development', subtitle: 'KEEP THE RALLY GOING', Icon: Target, price: '500–600 THB', duration: '60 minutes', label: 'PROPOSED NEXT STEP', items: ['More consistent shots & returns', 'Glass defence & recovery', 'Positioning and playing as a pair'], note: 'For players ready to move beyond the basics.' },
  { number: '03', title: 'Competitive', subtitle: 'MAKE BETTER DECISIONS', Icon: Trophy, price: '600–800 THB', duration: '60–90 minutes', label: 'PROPOSED NEXT STEP', items: ['Cross-court choices & lobs', 'Partner communication', 'When to attack and defend'], note: 'For low-intermediate players and above.' },
]
const skillIcons = [[Hand, Move, BookOpen], [Repeat2, RotateCcw, Footprints], [ArrowUpRight, MessagesSquare, ShieldCheck]]
const clinics = [
  { Icon: Layers, title: 'Wall & Glass', text: 'Turn awkward rebounds into playable shots.' },
  { Icon: Shield, title: 'Net & Volley', text: 'Take the net. Keep the advantage.' },
  { Icon: Network, title: 'Tactical Clinic', text: 'Choose the shot that opens up the point.' },
  { Icon: Swords, title: 'Clinic & Match Play', text: 'Learn it. Try it in a coached game.' },
]
function ClinicStepVisual({ step, t }: { step: number; t: (text: string) => string }) {
  if (step === 0) return <img className="clinic-step-court" src="/coaching/group-clinic-minimal.png" alt={t('Four players training on court with their coach')} />
  if (step === 2) return <img className="clinic-step-tactics" src="/coaching/tactics-player.png" alt={t('A player’s view of court positioning and shot choices')} />
  if (step === 1) return <svg viewBox="0 0 300 190" role="img" aria-label={t('Skill readout with a radar map and scored strengths and weaknesses')}>
    <rect className="clinic-mini-surface" x="12" y="12" width="276" height="166" rx="10"/>
    <g className="clinic-mini-grid"><polygon points="86,42 131,68 131,120 86,146 41,120 41,68"/><polygon points="86,59 116,77 116,111 86,129 56,111 56,77"/><path d="M86 42V146M41 68L131 120M41 120L131 68"/></g>
    <polygon className="clinic-mini-area" points="86,53 115,77 119,113 86,118 73,102 58,78"/>
    <circle className="clinic-mini-priority" cx="73" cy="102" r="4"/>
    <g className="clinic-mini-tracks"><path d="M162 60H264M162 84H264M162 108H264M162 132H264"/></g>
    <g className="clinic-mini-bars"><path d="M162 60H244M162 84H225M162 132H232"/></g><path className="clinic-mini-low" d="M162 108H193"/>
    <text className="clinic-mini-label" x="86" y="165">{t('Your skills')}</text><text className="clinic-mini-label" x="213" y="165">{t('Your priorities')}</text>
  </svg>
  return <svg viewBox="0 0 300 190" role="img" aria-label={t('Illustration comparing a starting assessment with a later progress review')}>
    <rect className="clinic-mini-surface" x="12" y="12" width="276" height="166" rx="10"/>
    <g className="clinic-mini-grid"><path d="M42 52H263M42 88H263M42 124H263M42 148H263"/></g>
    <path className="clinic-mini-before" d="M52 125L102 103L150 116L201 78L252 88"/>
    <path className="clinic-mini-after" d="M52 125L102 91L150 95L201 50L252 60"/>
    <g className="clinic-mini-dots"><circle cx="52" cy="125" r="4"/><circle cx="102" cy="91" r="4"/><circle cx="150" cy="95" r="4"/><circle cx="201" cy="50" r="4"/><circle cx="252" cy="60" r="4"/></g>
    <path className="clinic-mini-before" d="M47 164H63"/><text className="clinic-mini-label clinic-mini-label-start" x="70" y="168">{t('Start')}</text>
    <path className="clinic-mini-after" d="M163 164H179"/><text className="clinic-mini-label clinic-mini-label-start" x="186" y="168">{t('Recheck')}</text>
  </svg>
}

export default function CoachingPage() {
  const [language, setLanguage] = useState<'en' | 'th'>(() => { try { return localStorage.getItem('coaching-language') === 'th' ? 'th' : 'en' } catch { return 'en' } })
  const t = (text: string) => language === 'th' ? text.replace(text.trim(), (thai as Record<string, string>)[text.trim()] ?? text.trim()) : text
  const chooseLanguage = (value: 'en' | 'th') => { setLanguage(value); try { localStorage.setItem('coaching-language', value) } catch { /* Storage may be unavailable. */ } }

  return <main className="clinic-page" lang={language}>

    <section className="clinic-sheet"><div className="clinic-topbar"><Link className="clinic-hero-logo" to="/competitive" aria-label={t('Success Padel home')}><img src="/brand/logo-padel.webp" alt="Success Padel Samui" /></Link><nav className="clinic-language" aria-label="Language / ภาษา"><button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => chooseLanguage('en')}>🇬🇧 English</button><button type="button" lang="th" aria-pressed={language === 'th'} onClick={() => chooseLanguage('th')}>🇹🇭 ไทย</button></nav></div>
      <header className="clinic-heading"><div><h1>{t('Improve your padel.')}<em>{t('Without the guesswork.')}</em></h1><p>{t('Small-group coaching. Priority for our competition players.')}</p><div className="clinic-hero-price"><strong><small>{t('Only')}</small> 500 <small>{t('THB')}</small></strong><span>{t('per person')}</span></div></div><figure className="clinic-coaching-visual"><img src="/coaching/group-clinic-minimal.png" alt={t('Illustration of four players practising on a blue padel court with a coach watching beside the entrance')}/><figcaption><span className="clinic-hero-places"><Users aria-hidden="true"/><span>{t('Only 4 places')}</span></span><span><ClipboardCheck aria-hidden="true"/><strong>1</strong> {t("coach")}</span><span><Clock3 aria-hidden="true"/><strong>60</strong> {t("min")}</span></figcaption></figure></header>
      <section className="clinic-purpose" aria-labelledby="clinic-purpose-title">
        <h2 id="clinic-purpose-title">{t('One hour with your coach.')} <em>{t('A week of support.')}</em></h2>
        <ol className="clinic-week-steps">
          {[
            {Icon: Target, target: 'clinic-oncourt-title', title: 'Train on court', text: 'One hour of exercises matched to your level.'},
            {Icon: ClipboardCheck, target: 'player-plan-title', title: 'Get your readout', text: 'See your strengths and what needs work.'},
            {Icon: BookOpen, target: 'tactics-insight', title: 'Practise the theory', text: 'Homework built around your results.'},
            {Icon: Repeat2, target: 'clinic-week-review', title: 'Check back in a week', text: 'Review your progress. Choose your next focus.'},
          ].map(({Icon,title,text,target},index)=><li key={title}><div className="clinic-week-step-marker"><Icon aria-hidden="true"/><span>{index+1}</span></div><h3>{t(title)}</h3><p>{t(text)}</p><a className="clinic-week-step-visual" href={`#${target}`} aria-label={t(title)}><ClinicStepVisual step={index} t={t}/></a></li>)}
        </ol>
      </section>
      <header className="clinic-stage-heading"><span>{t('01 · ON COURT')}</span><h2 id="clinic-oncourt-title">{t('Coaching matched to your level.')}</h2></header>
      <section className="clinic-levels" aria-label={t('Three coaching levels')}>{levels.map(({number,title,subtitle,Icon,price,duration,label,items,note})=><article className="clinic-level" key={number} data-level={number}><div className="clinic-level-top"><Icon aria-hidden="true"/><span>{t("LEVEL ")}{number}</span><span className="clinic-level-status">{t(label)}</span></div><h2>{t(title)}</h2><p className="clinic-level-subtitle">{t(subtitle)}</p><ul>{items.map((item, index) => { const SkillIcon = skillIcons[Number(number) - 1][index]; return <li key={t(item)}><SkillIcon aria-hidden="true" /><span>{t(item)}</span></li> })}</ul><p className="clinic-level-note">{t(note)}</p><div className="clinic-level-meta"><span><Coins aria-hidden="true"/><strong>{t(price)}</strong> {t("/ person")}</span><span><Clock3 aria-hidden="true"/>{t(duration)}</span></div></article>)}</section>
      <p className="clinic-proposal-note">{t("Beginner trial first. Levels 2–3 and prices are planned.")}</p>
      <section className="clinic-specialists"><h2>{t("Find your next breakthrough.")}</h2><p>{t("Focused clinics we’re planning.")}</p><div className="clinic-options">{clinics.map(({Icon,title,text})=><article key={t(title)}><Icon aria-hidden="true"/><h3>{t(title)}</h3><p>{t(text)}</p></article>)}</div></section>
      <section className="clinic-player-plan" id="player-plan-title" aria-labelledby="clinic-offcourt-title">
        <header className="clinic-between-heading">
          <h2 id="clinic-offcourt-title">{t('Your personal tracker')}</h2>
        </header>
        <figure className="clinic-performance-report" aria-label={t('Illustration of a skill assessment and targeted practice priorities')}>
          <div className="clinic-report-body">
            <div className="clinic-report-map">
              <svg viewBox="0 0 360 320" role="img" aria-label={t('Skill map showing stronger forehand and lower positioning scores')}>
                <g className="clinic-radar-grid"><polygon points="180,46 279,103 279,217 180,274 81,217 81,103"/><polygon points="180,74.5 254,117 254,203 180,245.5 106,203 106,117"/><polygon points="180,103 229.5,131.5 229.5,188.5 180,217 130.5,188.5 130.5,131.5"/><polygon points="180,131.5 205,146 205,174 180,188.5 155,174 155,146"/><path d="M180 46V274M81 103L279 217M81 217L279 103"/></g>
                <polygon className="clinic-radar-area" points="180,69 237,127 247,199 180,212 153,176 117,124"/>
                <g className="clinic-radar-points"><circle cx="180" cy="69" r="5"/><circle cx="237" cy="127" r="5"/><circle cx="247" cy="199" r="5"/><circle cx="180" cy="212" r="5"/><circle cx="153" cy="176" r="5"/><circle cx="117" cy="124" r="5"/></g>
                <g className="clinic-radar-labels"><text x="180" y="25">{t('Forehand')}</text><text x="300" y="96">{t('Backhand')}</text><text x="300" y="238">{t('Smash')}</text><text x="180" y="302">{t('Stamina')}</text><text x="55" y="238">{t('Positioning')}</text><text x="55" y="96">{t('Reaction')}</text></g>
              </svg>
            </div>
            <div className="clinic-report-metrics">
              <div className="clinic-report-column-head"><span>/ 100</span></div>
              {[
                {label:'Forehand',score:80}, {label:'Backhand',score:58}, {label:'Smash',score:68}, {label:'Positioning',score:28},
                {label:'Reaction',score:64}, {label:'Stamina',score:46}, {label:'Speed',score:72}, {label:'Power',score:60},
              ].map(({label,score})=><div className="clinic-report-stat" data-priority={score<50} key={label}>
                <span>{t(label)}</span><div className="clinic-report-meter" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} data-filled={i<Math.round(score/5)}/>)}</div><strong>{score}</strong>
              </div>)}
            </div>
          </div>
        </figure>
      <section className="clinic-tactics-insight" id="tactics-insight">
        <div className="clinic-offcourt-intro"><span className="clinic-stage-label">{t('03 · DURING THE WEEK')}</span><h2>{t('See the gap.')} <em>{t('Know where to move.')}</em></h2><p>{t('Your theory homework turns coaching advice into decisions you understand.')}</p></div>
        <div className="clinic-court-gallery">{[
          { image: 'tactics-3d.png', title: 'Read the space.' },
          { image: 'tactics-overhead.png', title: 'Find a better position.' },
          { image: 'tactics-player.png', title: 'See it from your side.' },
        ].map(view => <figure key={view.image}><img src={`/coaching/${view.image}`} alt={t(view.title)} loading="lazy"/><figcaption><strong>{t(view.title)}</strong></figcaption></figure>)}</div>
        <p className="clinic-tactics-planned">{t('Interactive positioning tests are in development.')}</p>
      </section>
        <div className="clinic-week-review" id="clinic-week-review"><div className="clinic-review-copy"><span className="clinic-stage-label">{t('04 · A WEEK LATER')}</span><h3>{t('A week later. See what’s changed.')}</h3><p>{t('Recheck with your coach, review your progress and adjust your practice.')}</p></div><figure className="clinic-review-visual"><ClinicStepVisual step={3} t={t}/></figure></div>
      </section>
      <section className="clinic-gym-support" aria-labelledby="clinic-gym-title"><Dumbbell aria-hidden="true"/><div><h2 id="clinic-gym-title">{t('Build the fitness your game needs.')}</h2><p>{t('If fitness or physical limitations hold you back, explore personalised training with Coach Boon at Success Gym.')}</p><span>{t('Optional gym packages · purchased separately')}</span></div></section>
      <section className="clinic-offer-simple" aria-label={t('Beginner trial')}><div><span className="clinic-trial-kicker">{t('FIRST BEGINNER TRIAL')}</span><h2>{t('Be one of the first 4.')}</h2><p>{t('Ask the club team to book your trial.')}</p></div><div className="clinic-offer-price"><strong>500 <small>{t('THB')}</small></strong><span>{t('/ person')}</span></div></section>
<footer className="clinic-practical"><div><CalendarDays aria-hidden="true"/><p><strong>{t("First class planned for next week")}</strong><span>{t("Date and time to be confirmed.")}</span></p></div><div><MapPin aria-hidden="true"/><p><strong>Success Padel Samui</strong><span>{t("Coaching with David.")}</span></p></div><div><MessageCircle aria-hidden="true"/><p><strong>{t("Help shape what comes next.")}</strong><span>{t("Try the class. Tell us what helped.")}</span></p></div></footer>
    </section>
  </main>
}
