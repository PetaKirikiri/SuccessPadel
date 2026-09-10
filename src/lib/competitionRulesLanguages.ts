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
}

export const rulesCopy: Record<RulesLanguage, RulesCopy> = {
  en: {
    title: "Tonight’s Rules", facts: ['Format', 'Games', 'Game time', 'Break'],
    formats: ['Americano rotation', 'Fixed-pair Duo Americano'], minutes: '{n} minutes', enter: 'Open competition',
    steps: [
      ['Golden point at 40–40.', 'One deciding point wins the game. No advantage.'],
      ['Play to {target} games.', 'Stop when one team reaches {target}, or when the {minutes}-minute timer ends.'],
      ['Enter games won.', 'For example, enter 6–3—not individual points such as 40–30.'],
      ['Earn your team’s score.', 'Every player receives the number of games their team won in that round.'],
      ['Climb the leaderboard.', 'Scores from all {rounds} rounds are added together. The highest total wins.'],
    ],
    rotation: ['Rotate partners.', 'Your partner and opponents change each round, so everyone plays with different people.'],
    duos: ['Meet new opponents.', 'Your pair stays together while the opposing pair changes.'],
  },
  th: {
    title: 'กติกาคืนนี้', facts: ['รูปแบบ', 'จำนวนรอบ', 'เวลาเล่นต่อรอบ', 'เวลาพัก'],
    formats: ['อเมริกาโนแบบหมุนเวียนคู่', 'ดูโออเมริกาโนแบบคู่ประจำ'], minutes: '{n} นาที', enter: 'เปิดการแข่งขัน',
    steps: [
      ['โกลเดนพอยต์เมื่อ 40–40', 'เล่นแต้มตัดสินเพียงแต้มเดียว ผู้ชนะได้เกม ไม่มีแอดแวนเทจ'],
      ['เล่นถึง {target} เกม', 'หยุดเมื่อทีมใดทีมหนึ่งได้ {target} เกม หรือเมื่อหมดเวลา {minutes} นาที'],
      ['กรอกจำนวนเกมที่ชนะ', 'ตัวอย่างเช่น กรอก 6–3 ไม่ใช่แต้มในเกม เช่น 40–30'],
      ['รับคะแนนตามผลของทีม', 'ผู้เล่นแต่ละคนจะได้คะแนนเท่ากับจำนวนเกมที่ทีมของตนชนะในรอบนั้น'],
      ['สะสมคะแนนบนตารางอันดับ', 'รวมคะแนนจากทั้ง {rounds} รอบ ผู้ที่มีคะแนนรวมสูงสุดเป็นผู้ชนะ'],
    ],
    rotation: ['เปลี่ยนคู่ในแต่ละรอบ', 'คู่ของคุณและคู่แข่งจะเปลี่ยนทุกรอบ เพื่อให้ทุกคนได้เล่นกับผู้เล่นที่หลากหลาย'],
    duos: ['พบคู่แข่งใหม่', 'คุณจะเล่นกับคู่เดิมตลอดการแข่งขัน โดยเปลี่ยนคู่แข่งในแต่ละรอบ'],
  },
  fr: {
    title: 'Les règles de ce soir', facts: ['Format', 'Manches', 'Durée par manche', 'Pause'],
    formats: ['Americano avec rotation', 'Duo Americano à paires fixes'], minutes: '{n} minutes', enter: 'Voir la compétition',
    steps: [
      ['Point décisif à 40–40.', 'Un seul point décide du jeu. Pas d’avantage.'],
      ['Jouez jusqu’à {target} jeux.', 'Arrêtez dès qu’une équipe atteint {target} jeux ou à la fin des {minutes} minutes.'],
      ['Saisissez les jeux gagnés.', 'Par exemple, saisissez 6–3, et non les points d’un jeu comme 40–30.'],
      ['Marquez les points de votre équipe.', 'Chaque joueur reçoit autant de points que de jeux gagnés par son équipe dans cette manche.'],
      ['Grimpez au classement.', 'Les scores des {rounds} manches sont additionnés. Le total le plus élevé l’emporte.'],
    ],
    rotation: ['Changez de partenaire.', 'Votre partenaire et vos adversaires changent à chaque manche pour varier les rencontres.'],
    duos: ['Rencontrez de nouveaux adversaires.', 'Votre paire reste la même, tandis que la paire adverse change.'],
  },
  ru: {
    title: 'Правила на сегодня', facts: ['Формат', 'Раунды', 'Время раунда', 'Перерыв'],
    formats: ['Американо со сменой партнёров', 'Дуо Американо с постоянными парами'], minutes: '{n} мин.', enter: 'Открыть соревнование',
    steps: [
      ['Золотое очко при 40–40.', 'Одно решающее очко определяет победителя гейма. Без преимущества.'],
      ['Играйте до {target} геймов.', 'Остановитесь, когда одна команда выиграет {target} геймов или истекут {minutes} минут.'],
      ['Введите выигранные геймы.', 'Например, введите 6–3, а не очки внутри гейма, такие как 40–30.'],
      ['Получайте очки своей команды.', 'Каждый игрок получает столько очков, сколько геймов его команда выиграла в этом раунде.'],
      ['Поднимайтесь в таблице лидеров.', 'Результаты всех {rounds} раундов суммируются. Побеждает участник с наибольшей суммой.'],
    ],
    rotation: ['Меняйте партнёров.', 'Партнёр и соперники меняются каждый раунд, чтобы все играли с разными участниками.'],
    duos: ['Встречайте новых соперников.', 'Ваша пара остаётся неизменной, а пара соперников меняется.'],
  },
  he: {
    title: 'החוקים להערב', facts: ['פורמט', 'סיבובים', 'משך סיבוב', 'הפסקה'],
    formats: ['אמריקנו עם חילופי שותפים', 'דואו אמריקנו בזוגות קבועים'], minutes: '{n} דקות', enter: 'פתיחת התחרות',
    steps: [
      ['נקודת זהב ב־⁦40–40⁩.', 'נקודה מכריעה אחת קובעת מי מנצח במשחקון. ללא יתרון.'],
      ['שחקו עד {target} משחקונים.', 'עוצרים כשקבוצה אחת מגיעה ל־{target} משחקונים, או בתום {minutes} דקות.'],
      ['הזינו את מספר המשחקונים שניצחתם.', 'לדוגמה, הזינו ⁦6–3⁩ ולא נקודות בתוך משחקון כמו ⁦40–30⁩.'],
      ['קבלו את הניקוד של הקבוצה שלכם.', 'כל שחקן מקבל נקודות כמספר המשחקונים שהקבוצה שלו ניצחה באותו סיבוב.'],
      ['התקדמו בטבלת הדירוג.', 'מחברים את התוצאות מכל {rounds} הסיבובים. מי שצבר את הניקוד הגבוה ביותר מנצח.'],
    ],
    rotation: ['מחליפים שותפים.', 'השותף והיריבים מתחלפים בכל סיבוב, כך שכולם משחקים עם אנשים שונים.'],
    duos: ['פוגשים יריבים חדשים.', 'הזוג שלכם נשאר קבוע, והזוג היריב מתחלף.'],
  },
}
