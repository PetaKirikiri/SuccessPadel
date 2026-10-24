import { Link } from 'react-router-dom'
import { Sprout, Target, Trophy, Clock3, Users, Coins, CalendarDays, MapPin, Layers, Shield, Network, MessageCircle, ArrowRight, Swords, Hand, Move, BookOpen, Repeat2, RotateCcw, Footprints, ArrowUpRight, MessagesSquare, ShieldCheck, ClipboardCheck, Dumbbell, TrendingUp } from 'lucide-react'
import './coaching.css'

const levels = [
  { number: '01', title: 'Beginner', subtitle: 'START PLAYING', Icon: Sprout, price: '500 THB', duration: '60 minutes', label: 'FIRST TRIAL', items: ['Grip & basic positioning', 'Forehand, backhand & serving', 'Basic rules and confidence on court'], note: 'Selected fundamentals in each class, adapted to the group.' },
  { number: '02', title: 'Skill Development', subtitle: 'BUILD YOUR GAME', Icon: Target, price: '500–600 THB', duration: '60 minutes', label: 'PROPOSED NEXT STEP', items: ['More consistent shots & returns', 'Glass defence & recovery', 'Positioning and playing as a pair'], note: 'For players who have the basics and can rally.' },
  { number: '03', title: 'Competitive', subtitle: 'PLAY SMARTER', Icon: Trophy, price: '600–800 THB', duration: '60–90 minutes', label: 'PROPOSED NEXT STEP', items: ['Cross-court choices & lobs', 'Partner communication', 'When to attack and defend'], note: 'Tactical development for low-intermediate players and above.' },
]
const skillIcons = [[Hand, Move, BookOpen], [Repeat2, RotateCcw, Footprints], [ArrowUpRight, MessagesSquare, ShieldCheck]]
const clinics = [
  { Icon: Layers, title: 'Wall & Glass', text: 'Read the rebound, defend and recover your position.' },
  { Icon: Shield, title: 'Net & Volley', text: 'Volley technique, partner movement and controlling the net.' },
  { Icon: Network, title: 'Tactical Clinic', text: 'Shot selection, lobs and smarter decisions together.' },
  { Icon: Swords, title: 'Clinic & Match Play', text: '30 minutes of technique + 30 minutes of coached games.' },
]
export default function CoachingPage() {
  return <main className="clinic-page">

    <section className="clinic-sheet">
      <header className="clinic-heading"><div><Link className="clinic-hero-logo" to="/competitive" aria-label="Success Padel home"><img src="/brand/logo-padel.webp" alt="Success Padel Samui" /></Link><span className="clinic-tag">SMALL GROUP COACHING</span><h1>PLAY WITH <em>A PLAN.</em></h1><p>Coaching at your level. A clear picture of your game. A plan to get better.</p></div><figure className="clinic-coaching-visual"><img src="/coaching/group-clinic-minimal.png" alt="Illustration of four players practising on a blue padel court with a coach watching beside the entrance"/><figcaption><span><Users aria-hidden="true"/><strong>4</strong> players</span><span><ClipboardCheck aria-hidden="true"/><strong>1</strong> coach</span><span><Clock3 aria-hidden="true"/><strong>60</strong> min</span></figcaption></figure></header>
      <div className="clinic-pilot"><Sprout aria-hidden="true" /><div><strong>STARTING WITH A BEGINNER TRIAL</strong><span>Coach David · 1 hour · maximum 4 players · 500 THB per person</span></div></div>
      <div className="clinic-offer"><div className="clinic-limited"><Users aria-hidden="true"/><div><span>SMALL GROUP. LIMITED PLACES.</span><h2>Only 4 places per class.</h2><p>Get in early. Ask the club team to book your place in the beginner trial.</p></div></div><div><span>BEGINNER TRIAL · PER PERSON</span><strong>500 <small>THB</small></strong><p>60 minutes with Coach David · Maximum 4 players</p></div><div><span>PRIVATE LESSON COMPARISON</span><strong className="clinic-private-price">2,000 THB / hour</strong><p>A shared group session makes coaching more accessible.</p></div></div>
      <section className="clinic-levels" aria-label="Three coaching levels">{levels.map(({number,title,subtitle,Icon,price,duration,label,items,note})=><article className="clinic-level" key={number} data-level={number}><div className="clinic-level-top"><Icon aria-hidden="true"/><span>LEVEL {number}</span><span className="clinic-level-status">{label}</span></div><h2>{title}</h2><p className="clinic-level-subtitle">{subtitle}</p><ul>{items.map((item, index) => { const SkillIcon = skillIcons[Number(number) - 1][index]; return <li key={item}><SkillIcon aria-hidden="true" /><span>{item}</span></li> })}</ul><p className="clinic-level-note">{note}</p><div className="clinic-level-meta"><span><Coins aria-hidden="true"/><strong>{price}</strong> / person</span><span><Clock3 aria-hidden="true"/>{duration}</span><span><Users aria-hidden="true"/>4 players</span></div></article>)}</section>
      <p className="clinic-proposal-note">Levels 2–3 are proposed programmes and indicative prices. We’ll start with the beginner trial and develop future classes from your feedback.</p>
      <section className="clinic-player-plan" aria-labelledby="player-plan-title">
        <div className="clinic-plan-intro"><span className="clinic-tag">MORE THAN YOUR HOUR ON COURT</span><h2 id="player-plan-title">KNOW YOUR GAME.<br /><em>KNOW YOUR NEXT STEP.</em></h2><p>Your player snapshot gives you something to take away: a clear breakdown of your strengths, the areas to improve and your next practical steps.</p></div>
        <figure className="clinic-snapshot" aria-label="Illustrative player assessment, not an actual player result">
          <figcaption><div><span className="clinic-tag">YOUR PLAYER SNAPSHOT</span><h3>A clearer picture of your game.</h3></div><span className="clinic-example-label">EXAMPLE ASSESSMENT</span></figcaption>
          <div className="clinic-snapshot-grid"><div className="clinic-assessment-skills">
            <div><Move aria-hidden="true"/><span>Forehand</span><strong>Strength</strong></div>
            <div><RotateCcw aria-hidden="true"/><span>Backhand</span><strong>Developing</strong></div>
            <div><ArrowUpRight aria-hidden="true"/><span>Overhead</span><strong>Developing</strong></div>
            <div><MapPin aria-hidden="true"/><span>Positioning</span><strong>Priority</strong></div>
            <div><Target aria-hidden="true"/><span>Reaction</span><strong>To assess</strong></div>
            <div><TrendingUp aria-hidden="true"/><span>Stamina · speed · power</span><strong>To assess</strong></div>
          </div><div className="clinic-snapshot-priority"><Target aria-hidden="true"/><span>YOUR NEXT FOCUS</span><h4>Recover with your partner.</h4><p>After each shot, return to a shared position that closes the space between you.</p><div><strong>On court</strong><p>Practise recovery after a cross-court rally.</p></div><div><strong>Beyond the court</strong><p>Review your positioning in the 3D tactics court. Discuss movement support with your coach if needed.</p></div></div></div>
        </figure>
        <div className="clinic-plan-steps">
          <article><ClipboardCheck aria-hidden="true"/><h3>Your player snapshot</h3><p>A coach-led assessment of your forehand, backhand, overheads, positioning and reactions, alongside stamina, speed and power.</p><strong>A clear picture of where you are today.</strong></article>
          <article><Target aria-hidden="true"/><h3>Your next priorities</h3><p>Leave with a small set of priorities and coach-recommended practice to focus your effort between sessions.</p><strong>Know what to practise between classes.</strong></article>
          <article><Dumbbell aria-hidden="true"/><h3>A plan for your body</h3><p>If your coach identifies a possible physical limitation, explore support from Success Gym. A trainer can assess strength, mobility or conditioning and recommend a suitable package.</p><strong>Train for what your game actually needs.</strong></article>
          <article><TrendingUp aria-hidden="true"/><h3>See your progress</h3><p>Revisit your player snapshot with your coach and trainer to see what’s improving and choose your next goal.</p><strong>Make your improvement visible.</strong></article>
        </div>
        <p className="clinic-plan-status">Your coaching includes a strengths-and-weaknesses breakdown and recommended next steps. Success Gym training is a separate service; packages and pricing are confirmed with the gym.</p>
      </section>
      <section className="clinic-tactics-insight" id="tactics-insight">
        <div className="clinic-court-gallery">{[
          { image: 'tactics-3d.png', title: '3D court', description: 'Read the space and the shot.' },
          { image: 'tactics-overhead.png', title: 'Overhead', description: 'See the gaps in your coverage.' },
          { image: 'tactics-player.png', title: 'Player view', description: 'See the decision from on court.' },
        ].map(view => <figure key={view.image}><img src={`/coaching/${view.image}`} alt={`${view.title}: actual padel tactics court with power and height controls`} /><figcaption><strong>{view.title}</strong><span>{view.description}</span></figcaption></figure>)}</div>
        <div><span className="clinic-tag">SEE IT. UNDERSTAND IT. PLAY IT.</span><h2>GET REAL INSIGHT INTO<br /><em>WHY YOUR POSITION IS WRONG.</em></h2><p>Don’t just hear “move over.” See the space you leave open, the shots that can get past you and how your position affects your partner.</p><ul><li><MapPin aria-hidden="true"/><span><strong>Spot the gap.</strong> See which areas are exposed from your current position.</span></li><li><Users aria-hidden="true"/><span><strong>Move as a pair.</strong> Explore where you and your partner need to be.</span></li><li><ArrowRight aria-hidden="true"/><span><strong>Understand the shot.</strong> Follow the ball’s path and connect your decision to what happens next.</span></li></ul><p className="clinic-tactics-planned">In development: a personal learning area with preparation materials, weekly practice and positioning challenges. The aim is to build your padel IQ between classes; these course features are not included in the trial yet.</p></div>
      </section>
      <section className="clinic-specialists"><h2>CHOOSE WHAT YOU WANT TO IMPROVE</h2><p>Ideas for future focused clinics</p><div className="clinic-options">{clinics.map(({Icon,title,text})=><article key={title}><Icon aria-hidden="true"/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="clinic-pathway"><h2>YOUR PATH THROUGH THE CLUB</h2><p>Play a tournament <ArrowRight aria-hidden="true"/> Get a coach’s recommendation <ArrowRight aria-hidden="true"/> Join a clinic <ArrowRight aria-hidden="true"/> Put it into your next match</p><div><span><Target aria-hidden="true"/>Group players by ability</span><span><Users aria-hidden="true"/>Train with your partner</span><span><Trophy aria-hidden="true"/>Review progress after 3–4 classes</span></div></section>
      <div className="clinic-booking"><div><span>YOUR NEXT STEP</span><h2>Make one of those 4 places yours.</h2><p>Contact the Success Padel team to request your trial place and confirm the class time.</p></div><strong>500 THB <small>/ person</small></strong></div><footer className="clinic-practical"><div><CalendarDays aria-hidden="true"/><p><strong>First class planned for next week</strong><span>Date and time to be confirmed around court availability.</span></p></div><div><MapPin aria-hidden="true"/><p><strong>Success Padel Samui</strong><span>Ask the club team about the trial and available places.</span></p></div><div><MessageCircle aria-hidden="true"/><p><strong>Your feedback shapes the programme</strong><span>Shared group coaching, with time to practise together.</span></p></div></footer>
    </section>
  </main>
}
