export const rulesLanguages = [
  { id: 'en', flag: '🇬🇧', name: 'English' },
  { id: 'th', flag: '🇹🇭', name: 'ไทย' },
  { id: 'fr', flag: '🇫🇷', name: 'Français' },
  { id: 'ru', flag: '🇷🇺', name: 'Русский' },
  { id: 'he', flag: '🇮🇱', name: 'עברית' },
] as const

export type RulesLanguage = typeof rulesLanguages[number]['id']

type RulesCopy = {
  title: string
  facts: [string, string, string, string]
  formats: [string, string]
  minutes: string
  enter: string
  steps: [string, string][]
  rotation: [string, string]
  duos: [string, string]
  arrival: [string, string]
  warmup: string
  spirit: [string, string]
}

export const rulesCopy: Record<RulesLanguage, RulesCopy> = {
  en: {
    title: "Tonight’s Rules", facts: ['Format', 'Games', 'Game time', 'Break'],
    formats: ['Americano rotation', 'Fixed-pair Duo Americano'], minutes: '{n} minutes', enter: 'Open competition',
    arrival: ['First game starts at {start}.', 'Please come early. You’re welcome to warm up on the courts if they’re available.'],
    warmup: 'Come early to warm up.',
    spirit: ['Fun comes first.', 'We’re here to compete, but most importantly to have fun. Play fairly, show good sportsmanship, and be friendly and respectful to everyone.'],
    steps: [
      ['Golden point at 40–40.', 'One deciding point wins the game. No advantage.'],
      ['Play to {target} games.', 'Stop when one team reaches {target}, or when the {minutes}-minute timer ends.'],
      ['Enter games won.', 'For example, enter 6–3—not individual points such as 40–30.'],
      ['Earn your team’s score.', 'Every player receives the number of games their team won in that round.'],
      ['Climb the leaderboard.', 'Scores from all {rounds} rounds are added together. The highest total wins.'],
    ],
    rotation: ['Rotate partners.', 'Your partner and opponents change each round, so everyone plays with different people.'],
    duos: ['Play every team once.', 'Stay with your partner throughout. Each duo plays every other duo once.'],
  },
  th: {
    title: 'กติกาคืนนี้', facts: ['รูปแบบ', 'จำนวนรอบ', 'เวลาเล่นต่อรอบ', 'เวลาพัก'],
    formats: ['อเมริกาโนแบบหมุนเวียนคู่', 'ดูโออเมริกาโนแบบคู่ประจำ'], minutes: '{n} นาที', enter: 'เปิดการแข่งขัน',
    arrival: ['รอบแรกเริ่มเวลา {start} น.', 'กรุณามาถึงก่อนเวลา หากคอร์ตว่าง ผู้เล่นสามารถลงไปวอร์มอัปได้'],
    warmup: 'มาถึงก่อนเวลาเพื่อวอร์มอัป',
    spirit: ['ความสนุกสำคัญที่สุด', 'แม้จะเป็นการแข่งขัน แต่สิ่งสำคัญที่สุดคือความสนุก เล่นอย่างยุติธรรม มีน้ำใจนักกีฬา และเป็นมิตรพร้อมให้เกียรติทุกคน'],
    steps: [
      ['โกลเดนพอยต์เมื่อ 40–40', 'เล่นแต้มตัดสินเพียงแต้มเดียว ผู้ชนะได้เกม ไม่มีแอดแวนเทจ'],
      ['เล่นถึง {target} เกม', 'หยุดเมื่อทีมใดทีมหนึ่งได้ {target} เกม หรือเมื่อหมดเวลา {minutes} นาที'],
      ['กรอกจำนวนเกมที่ชนะ', 'ตัวอย่างเช่น กรอก 6–3 ไม่ใช่แต้มในเกม เช่น 40–30'],
      ['รับคะแนนตามผลของทีม', 'ผู้เล่นแต่ละคนจะได้คะแนนเท่ากับจำนวนเกมที่ทีมของตนชนะในรอบนั้น'],
      ['สะสมคะแนนบนตารางอันดับ', 'รวมคะแนนจากทั้ง {rounds} รอบ ผู้ที่มีคะแนนรวมสูงสุดเป็นผู้ชนะ'],
    ],
    rotation: ['เปลี่ยนคู่ในแต่ละรอบ', 'คู่ของคุณและคู่แข่งจะเปลี่ยนทุกรอบ เพื่อให้ทุกคนได้เล่นกับผู้เล่นที่หลากหลาย'],
    duos: ['พบทุกทีมทีมละหนึ่งครั้ง', 'เล่นกับคู่เดิมตลอดการแข่งขัน แต่ละคู่จะพบกับคู่อื่นทุกคู่ คู่ละหนึ่งครั้ง'],
  },
  fr: {
    title: 'Les règles de ce soir', facts: ['Format', 'Manches', 'Durée par manche', 'Pause'],
    formats: ['Americano avec rotation', 'Duo Americano à paires fixes'], minutes: '{n} minutes', enter: 'Voir la compétition',
    arrival: ['La première manche commence à {start}.', 'Merci d’arriver en avance. Vous pouvez vous échauffer sur les terrains s’ils sont disponibles.'],
    warmup: 'Arrivez en avance pour vous échauffer.',
    spirit: ['Le plaisir avant tout.', 'Nous sommes là pour la compétition, mais surtout pour nous amuser. Jouez fair-play, faites preuve d’esprit sportif et soyez chaleureux et respectueux envers tout le monde.'],
    steps: [
      ['Point décisif à 40–40.', 'Un seul point décide du jeu. Pas d’avantage.'],
      ['Jouez jusqu’à {target} jeux.', 'Arrêtez dès qu’une équipe atteint {target} jeux ou à la fin des {minutes} minutes.'],
      ['Saisissez les jeux gagnés.', 'Par exemple, saisissez 6–3, et non les points d’un jeu comme 40–30.'],
      ['Marquez les points de votre équipe.', 'Chaque joueur reçoit autant de points que de jeux gagnés par son équipe dans cette manche.'],
      ['Grimpez au classement.', 'Les scores des {rounds} manches sont additionnés. Le total le plus élevé l’emporte.'],
    ],
    rotation: ['Changez de partenaire.', 'Votre partenaire et vos adversaires changent à chaque manche pour varier les rencontres.'],
    duos: ['Affrontez chaque équipe une fois.', 'Gardez le même partenaire. Chaque duo affronte tous les autres duos une seule fois.'],
  },
  ru: {
    title: 'Правила на сегодня', facts: ['Формат', 'Раунды', 'Время раунда', 'Перерыв'],
    formats: ['Американо со сменой партнёров', 'Дуо Американо с постоянными парами'], minutes: '{n} мин.', enter: 'Открыть соревнование',
    arrival: ['Первый раунд начинается в {start}.', 'Пожалуйста, приходите заранее. Если корты свободны, вы можете размяться на них.'],
    warmup: 'Приходите заранее, чтобы размяться.',
    spirit: ['Главное — удовольствие от игры.', 'Мы соревнуемся, но прежде всего хотим хорошо провести время. Играйте честно, проявляйте спортивное благородство, будьте дружелюбны и уважайте друг друга.'],
    steps: [
      ['Золотое очко при 40–40.', 'Одно решающее очко определяет победителя гейма. Без преимущества.'],
      ['Играйте до {target} геймов.', 'Остановитесь, когда одна команда выиграет {target} геймов или истекут {minutes} минут.'],
      ['Введите выигранные геймы.', 'Например, введите 6–3, а не очки внутри гейма, такие как 40–30.'],
      ['Получайте очки своей команды.', 'Каждый игрок получает столько очков, сколько геймов его команда выиграла в этом раунде.'],
      ['Поднимайтесь в таблице лидеров.', 'Результаты всех {rounds} раундов суммируются. Побеждает участник с наибольшей суммой.'],
    ],
    rotation: ['Меняйте партнёров.', 'Партнёр и соперники меняются каждый раунд, чтобы все играли с разными участниками.'],
    duos: ['Сыграйте с каждой командой один раз.', 'Партнёр остаётся прежним. Каждая пара играет с каждой другой парой ровно один раз.'],
  },
  he: {
    title: 'החוקים להערב', facts: ['פורמט', 'סיבובים', 'משך סיבוב', 'הפסקה'],
    formats: ['אמריקנו עם חילופי שותפים', 'דואו אמריקנו בזוגות קבועים'], minutes: '{n} דקות', enter: 'פתיחת התחרות',
    arrival: ['הסיבוב הראשון מתחיל בשעה ⁦{start}⁩.', 'אנא הגיעו מוקדם. אפשר להתחמם במגרשים אם הם פנויים.'],
    warmup: 'הגיעו מוקדם כדי להתחמם.',
    spirit: ['הכי חשוב ליהנות.', 'אנחנו כאן כדי להתחרות, אבל קודם כול כדי ליהנות. שחקו בהגינות וברוח ספורטיבית, והיו ידידותיים ומכבדים כלפי כולם.'],
    steps: [
      ['נקודת זהב ב־⁦40–40⁩.', 'נקודה מכריעה אחת קובעת מי מנצח במשחקון. ללא יתרון.'],
      ['שחקו עד {target} משחקונים.', 'עוצרים כשקבוצה אחת מגיעה ל־{target} משחקונים, או בתום {minutes} דקות.'],
      ['הזינו את מספר המשחקונים שניצחתם.', 'לדוגמה, הזינו ⁦6–3⁩ ולא נקודות בתוך משחקון כמו ⁦40–30⁩.'],
      ['קבלו את הניקוד של הקבוצה שלכם.', 'כל שחקן מקבל נקודות כמספר המשחקונים שהקבוצה שלו ניצחה באותו סיבוב.'],
      ['התקדמו בטבלת הדירוג.', 'מחברים את התוצאות מכל {rounds} הסיבובים. מי שצבר את הניקוד הגבוה ביותר מנצח.'],
    ],
    rotation: ['מחליפים שותפים.', 'השותף והיריבים מתחלפים בכל סיבוב, כך שכולם משחקים עם אנשים שונים.'],
    duos: ['משחקים מול כל זוג פעם אחת.', 'נשארים עם אותו שותף לאורך התחרות. כל זוג משחק מול כל אחד מהזוגות האחרים פעם אחת.'],
  },
}

/** Short labels for the visual rules board; numbers come from the saved schedule. */
export const rulesHighlights: Record<RulesLanguage, {
  games: string; duration: string; break: string; golden: string; decider: string;
  fixed: string; rotate: string; partners: string; target: string; buzzer: string;
}> = {
  en: { games: 'Games total', duration: 'Minutes per game', break: 'Minute breaks',
    golden: 'Golden point', decider: 'One deciding point. No advantage.',
    fixed: 'Same', rotate: 'Rotate', partners: 'Partner', target: 'Games to win', buzzer: 'Or stop when the timer ends.' },
  th: { games: 'รอบทั้งหมด', duration: 'นาทีต่อรอบ', break: 'นาทีพักระหว่างรอบ',
    golden: 'โกลเดนพอยต์', decider: 'แต้มเดียวตัดสิน ไม่มีแอดแวนเทจ',
    fixed: 'คู่เดิม', rotate: 'เปลี่ยนคู่', partners: 'คู่เล่น', target: 'เกมเพื่อชนะ', buzzer: 'หรือหยุดเมื่อหมดเวลา' },
  fr: { games: 'Manches au total', duration: 'Minutes par manche', break: 'Minutes de pause',
    golden: 'Point décisif', decider: 'Un seul point. Pas d’avantage.',
    fixed: 'Même', rotate: 'Changez', partners: 'Partenaire', target: 'Jeux pour gagner', buzzer: 'Ou à la fin du temps imparti.' },
  ru: { games: 'Раундов всего', duration: 'Минут на раунд', break: 'Минут перерыва',
    golden: 'Золотое очко', decider: 'Одно решающее очко. Без преимущества.',
    fixed: 'Тот же', rotate: 'Смена', partners: 'Партнёр', target: 'Геймов для победы', buzzer: 'Или до конца таймера.' },
  he: { games: 'סיבובים בסך הכול', duration: 'דקות לסיבוב', break: 'דקות הפסקה',
    golden: 'נקודת זהב', decider: 'נקודה מכריעה אחת. ללא יתרון.',
    fixed: 'קבוע', rotate: 'מתחלף', partners: 'שותף', target: 'משחקונים לניצחון', buzzer: 'או עד לסיום הזמן.' },
}
