import {players,displayGames,playerState,roundDetails,clock,start} from './schedule.mjs';
export const translations={
 en:{
  starting:'Starting',joining:'Joining',staying:'Staying',switching:'Switch side',
  example:'See the rotation',game:'Game',court:'Court',off:'Off',on:'On',versus:'vs',
  tonight:'Wednesday 28 October',courtTime:'10 min playing',bench:'Off court — resting',backIn:'{n} min until {time}',done:'Finished · 40 min played',turn:'{n} min play · off {time}',benchNote:'Wait shown from this game’s start, including changeovers.',
  playLabel:'games each',restLabel:'per game',rhythmNote:'40 minutes playing each · 3-minute changeovers',
  startPlaying:'First 10 minutes',waited:'Waited {n} min → play 10 min',stay:'Stay',stayTime:'10 min played + 10 min now',restTime:'29 min rest · back {time}',waitNote:'Rest times include the 3-minute changeovers.',changeover:'3-minute changeover',
  title:'Rain mode',condition:'IF RAIN MODE IS ACTIVATED',intro:'If rain leaves us with only two playable courts, we’ll use this rotation for all 16 players.',
  first:'First round',finish:'Finish by',allocation:'Your playing time',matches:'matches each',minutes:' min',playing:'playing each',partners:'different partners',how:'How it works',rounds:'Eight rounds',language:'Language',
  steps:[
   ['Eight play. Eight rest.','Two matches run at the same time, one on each court.'],
   ['After game 1: two off each court.','Four players come off. Four waiting players come on—two to each court.'],
   ['After game 2: played two? Come off. Waited two? Come on.','The two players on each court who have played both games come off. The four who have waited for both games come on.'],
   ['Same court. New partners.','Keep rotating four off and four on. Stay assigned to the same court; switch sides within it only to mix partners.']
  ],
  end:'Scheduled finish 19:51. Nine minutes spare for overruns, with a 20:00 cutoff.',
  footer:'Please be ready before 18:10. Rain mode is a fallback format, not confirmation that play will go ahead.'
 },
 th:{
  starting:'เริ่มเล่น',joining:'เข้าใหม่',staying:'อยู่ต่อ',switching:'สลับฝั่ง',
  example:'ตัวอย่างการหมุนเวียนผู้เล่น',game:'รอบ',court:'สนาม',off:'ออก',on:'เข้า',versus:'พบ',
  tonight:'วันพุธที่ 28 ตุลาคม',courtTime:'เล่น 10 นาที',bench:'นอกสนาม — พัก',backIn:'อีก {n} นาที · เข้า {time}',done:'เล่นครบแล้ว · 40 นาที',turn:'เล่น {n} นาที · ออก {time}',benchNote:'เวลารอนับจากเริ่มรอบนี้ รวมเวลาเปลี่ยนรอบแล้ว',
  playLabel:'แมตช์ต่อคน',restLabel:'ต่อแมตช์',rhythmNote:'เล่นรวมคนละ 40 นาที · เปลี่ยนรอบ 3 นาที',
  startPlaying:'เริ่มเล่น 10 นาทีแรก',waited:'รอมาแล้ว {n} นาที → เล่น 10 นาที',stay:'อยู่ต่อ',stayTime:'เล่นแล้ว 10 นาที + เล่นต่ออีก 10 นาที',restTime:'พัก 29 นาที · กลับมา {time}',waitNote:'เวลาพักรวมเวลาเปลี่ยนรอบครั้งละ 3 นาทีแล้ว',changeover:'เปลี่ยนรอบ 3 นาที',
  title:'รูปแบบการแข่งขันกรณีฝนตก',condition:'หากมีการประกาศใช้รูปแบบนี้',intro:'หากฝนตกจนเหลือสนามที่เล่นได้เพียง 2 สนาม เราจะใช้การหมุนเวียนนี้สำหรับผู้เล่นทั้ง 16 คน',
  first:'รอบแรกเริ่ม',finish:'จบไม่เกิน',allocation:'เวลาเล่นของคุณ',matches:'แมตช์ต่อคน',minutes:' นาที',playing:'เวลาเล่นต่อคน',partners:'คู่หูไม่ซ้ำกัน',how:'เล่นอย่างไร',rounds:'ทั้งหมด 8 รอบ',language:'ภาษา',
  steps:[
   ['เล่น 8 คน พัก 8 คน','แข่งพร้อมกัน 2 แมตช์ สนามละ 1 แมตช์'],
   ['จบรอบ 1: ออกสนามละ 2 คน','ออกทั้งหมด 4 คน แล้วให้ผู้เล่นที่รออยู่ 4 คนลงแทน สนามละ 2 คน'],
   ['จบรอบ 2: เล่นครบ 2 รอบออก รอครบ 2 รอบเข้า','ผู้เล่นสนามละ 2 คนที่เล่นมาทั้งสองรอบออกพัก ส่วน 4 คนที่รอมาทั้งสองรอบลงเล่นแทน'],
   ['สนามเดิม คู่หูใหม่','ออก 4 คน เข้า 4 คน ทุกคนเล่นสนามเดิมตลอด สลับฝั่งภายในสนามเมื่อจำเป็นเพื่อเปลี่ยนคู่หู']
  ],
  end:'ตามตารางจบเวลา 19:51 น. เผื่อเวลาล่าช้า 9 นาที และต้องจบไม่เกิน 20:00 น.',
  footer:'กรุณาพร้อมลงเล่นก่อน 18:10 น. รูปแบบนี้เป็นแผนสำรองกรณีฝนตก ไม่ใช่การยืนยันว่าจะจัดการแข่งขันได้'
 },
 fr:{
  starting:'Départ',joining:'Entre',staying:'Reste',switching:'Change de côté',
  example:'Exemple de rotation',game:'Tour',court:'Terrain',off:'Sortent',on:'Entrent',versus:'contre',
  tonight:'Mercredi 28 octobre',courtTime:'10 min de jeu',bench:'Hors terrain — repos',backIn:'Dans {n} min · retour {time}',done:'Terminé · 40 min jouées',turn:'{n} min de jeu · sortie {time}',benchNote:'Attente depuis le début de ce tour, transitions comprises.',
  playLabel:'matchs par joueur',restLabel:'par match',rhythmNote:'40 minutes de jeu chacun · 3 minutes de transition',
  startPlaying:'Premières 10 minutes',waited:'{n} min d’attente → 10 min de jeu',stay:'Restent',stayTime:'10 min jouées + 10 min maintenant',restTime:'29 min de repos · retour à {time}',waitNote:'Les temps de repos incluent les transitions de 3 minutes.',changeover:'3 minutes de transition',
  title:'Format pluie',condition:'SI LE FORMAT PLUIE EST ACTIVÉ',intro:'Si la pluie ne laisse que deux terrains praticables, nous utiliserons cette rotation pour les 16 joueurs.',
  first:'Premier tour',finish:'Fin au plus tard',allocation:'Votre temps de jeu',matches:'matchs par joueur',minutes:' min',playing:'de jeu par joueur',partners:'partenaires différents',how:'Comment ça marche',rounds:'Huit tours',language:'Langue',
  steps:[
   ['Huit jouent. Huit se reposent.','Deux matchs se jouent en même temps, un sur chaque terrain.'],
   ['Après le premier tour : deux sortent de chaque terrain.','Quatre joueurs sortent. Quatre joueurs en attente entrent, deux par terrain.'],
   ['Après le deuxième tour : deux matchs joués, on sort ; deux tours attendus, on entre.','Sur chaque terrain, les deux joueurs qui ont joué les deux matchs sortent. Les quatre qui ont attendu les deux tours entrent.'],
   ['Même terrain. Nouveaux partenaires.','Quatre sortent, quatre entrent. Gardez le même terrain ; changez seulement de côté si nécessaire pour reformer les paires.']
  ],
  end:'Fin prévue à 19:51. Neuf minutes de marge en cas de retard, avec une fin impérative à 20:00.',
  footer:'Merci d’être prêts avant 18:10. Le format pluie est une solution de repli, pas une confirmation du maintien de la compétition.'
 },
 ru:{
  starting:'Старт',joining:'Выходит',staying:'Остаётся',switching:'Смена стороны',
  example:'Пример ротации',game:'Раунд',court:'Корт',off:'Уходят',on:'Выходят',versus:'против',
  tonight:'Среда, 28 октября',courtTime:'10 минут игры',bench:'Вне корта — отдых',backIn:'Через {n} мин · выход {time}',done:'Закончили · 40 мин игры',turn:'{n} мин игры · уход {time}',benchNote:'Ожидание с начала этого раунда, включая смены игроков.',
  playLabel:'матча на игрока',restLabel:'на матч',rhythmNote:'40 минут игры каждому · 3 минуты на смену',
  startPlaying:'Первые 10 минут игры',waited:'Ожидание {n} мин → игра 10 мин',stay:'Остаются',stayTime:'10 мин сыграно + ещё 10 мин',restTime:'29 мин отдыха · возвращение {time}',waitNote:'Время отдыха включает смены игроков по 3 минуты.',changeover:'3 минуты на смену',
  title:'Формат на случай дождя',condition:'ЕСЛИ БУДЕТ ВКЛЮЧЁН ЭТОТ ФОРМАТ',intro:'Если из-за дождя останутся только два пригодных для игры корта, все 16 игроков будут играть по этой схеме ротации.',
  first:'Первый раунд',finish:'Завершение до',allocation:'Ваше игровое время',matches:'матча на игрока',minutes:' мин',playing:'игры на человека',partners:'разных партнёра',how:'Как это работает',rounds:'Восемь раундов',language:'Язык',
  steps:[
   ['Восемь играют. Восемь отдыхают.','Одновременно проходят два матча — по одному на каждом корте.'],
   ['После первого раунда: по двое уходят с каждого корта.','Четверо уходят отдыхать. Четверо ожидавших выходят играть — по двое на каждый корт.'],
   ['После второго: сыграли два — отдыхаете; ждали два — играете.','С каждого корта уходят двое, сыгравшие оба матча. На их место выходят четверо, ожидавшие оба раунда.'],
   ['Тот же корт. Новые партнёры.','Четверо уходят, четверо выходят. Каждый остаётся на своём корте; меняйте сторону внутри него только для смены партнёров.']
  ],
  end:'По расписанию заканчиваем в 19:51. Есть девять минут на задержки, но завершить нужно не позднее 20:00.',
  footer:'Пожалуйста, будьте готовы к игре до 18:10. Это запасной формат на случай дождя, а не подтверждение того, что соревнование состоится.'
 }
};

const escape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const numberedName=n=>`<span class="person-number">${n}</span><span>${escape(players[n-1])}</span>`;
export function renderRounds(copy){
 return displayGames.map((courts,i)=>{
  const round=roundDetails(i);
  const swap=i?`<section class="round-swap"><h3>${clock(start(i)-3)}–${clock(start(i))} · ${copy.changeover}</h3>${[['off',copy.off,'↘'],['on',copy.on,'↗']].map(([key,label,arrow])=>`<div class="swap-row ${key}"><strong><span aria-hidden="true">${arrow}</span> ${label}</strong><div class="swap-players">${round[key].map(n=>`<span class="named-chip">${numberedName(n)}</span>`).join('')}</div></div>`).join('')}</section>`:'';
  return `${swap}<article class="example-game" id="game-${i+1}"><h3>${copy.game} ${i+1}<span>${round.time}</span></h3>
   <div class="example-courts">${courts.map((teams,c)=>`<section><h4>${copy.court} ${c+1}<small>${copy.courtTime}</small></h4>
    <div class="mini-court"><span class="court-net" aria-hidden="true"></span>${teams.map(pair=>`<div class="court-team">${pair.map(n=>{
     const state=playerState(i,c,n);
     return `<div class="court-person ${state}"><span class="court-player">${n}</span><span class="player-state">${state==='joining'?'↓ ':state==='switching'?'↕ ':''}${copy[state]}</span><strong>${escape(players[n-1])}</strong></div>`;
    }).join('')}</div>`).join('')}</div></section>`).join('')}</div>
   <section class="shared-bench"><h4>${copy.bench}</h4><div class="bench-players">${round.resting.map(person=>`<div class="bench-person"><span class="named-chip">${numberedName(person.number)}</span><small>${person.next<0?copy.done:copy.backIn.replace('{n}',person.wait).replace('{time}',person.returnAt)}</small></div>`).join('')}</div><p>${copy.benchNote}</p></section>
  </article>`;
 }).join('');
}

if(typeof document!=='undefined'){
 function setLanguage(lang){
  const copy=translations[lang];
  document.documentElement.lang=lang;document.title=`${copy.title} · Success Padel`;
  const text=(selector,value)=>{document.querySelector(selector).textContent=value};
  text('h1',copy.title);text('.eyebrow',copy.condition);text('.intro>p:not(.eyebrow)',copy.intro);
  const times=document.querySelectorAll('.timing span');times[0].textContent=copy.first;times[1].textContent=copy.finish;
  document.querySelector('.allocation').setAttribute('aria-label',copy.allocation);
  text('.play-label',copy.playLabel);text('.rest-label',copy.restLabel);text('.rhythm-note',copy.rhythmNote);
  document.querySelectorAll('.unit').forEach(unit=>{unit.textContent=copy.minutes});
  text('.rotation h2',copy.how);text('.schedule h2',copy.rounds);
  text('#example-title',copy.tonight);
  document.querySelector('#example-rounds').innerHTML=renderRounds(copy);
  document.querySelectorAll('.rotation li').forEach((item,i)=>{
   item.querySelector('strong').textContent=copy.steps[i][0];item.querySelector('span').textContent=copy.steps[i][1];
  });
  text('.schedule p',copy.end);text('footer',copy.footer);
  document.querySelector('.languages').setAttribute('aria-label',copy.language);
  document.querySelectorAll('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===lang)));
  document.querySelector('meta[name="description"]').content=copy.intro;
  document.querySelector('meta[property="og:title"]').content=`${copy.title} · Success Padel`;
  document.querySelector('meta[property="og:description"]').content=copy.intro;
 }
 const requested=new URL(location.href).searchParams.get('lang');
 setLanguage(Object.hasOwn(translations,requested)?requested:'en');
 document.querySelector('.languages').addEventListener('click',event=>{
  const button=event.target.closest('[data-lang]');if(!button)return;
  const lang=button.dataset.lang;if(!Object.hasOwn(translations,lang))return;
  const url=new URL(location.href);url.searchParams.set('lang',lang);
  history.replaceState(null,'',url);setLanguage(lang);
 });
}
