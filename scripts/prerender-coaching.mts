import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { CoachingContent } from '../src/surfaces/coaching/CoachingContent'

const shell = await readFile('dist/index.html', 'utf8')
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const page = manifest['src/surfaces/coaching/CoachingPage.tsx']
if (!page?.css?.length) throw new Error('Coaching CSS is missing from the build manifest')
// Availability and personal booking state are fetched after sign-in in the app.
// Never publish a cached number of remaining places or a player's account data.
const booking = createElement('div', { className: 'clinic-booking-action', id: 'clinic-booking' },
  createElement('a', { className: 'clinic-book-now', href: '/coaching?book=1' }, 'Book now'),
  createElement('noscript', null, 'Enable JavaScript to check available places and book with your Success Padel account.'),
)
const content = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/coaching'] },
  createElement(CoachingContent, { language: 'en', chooseLanguage: () => {}, booking }),
))
const title = 'Padel Coaching | Success Padel Samui'
const description = 'One hour with your coach. A week of support. Small-group padel coaching, a personal skill tracker and targeted practice. Only 500 THB per person.'
const image = 'https://successpadel.app/coaching/group-clinic-minimal.png'
let html = shell.replace('<div id="root"></div>', `<div id="root">${content}</div>`)
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(/(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/, `$1${title}$2`)
  .replace(/(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/, '$1https://successpadel.app/coaching$2')
  .replace(/(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/, `$1${description}$2`)
  .replace(/https:\/\/successpadel\.app\/brand\/success-padel-chest-preview-v1\.jpg/g, image)
  .replace(/Silver Success Padel Samui emblem on a navy superhero suit/g, 'Small-group padel coaching at Success Padel Samui')
  .replace(/<meta\s+property="og:image:(?:width|height)"[^>]*>/g, '')
  .replace('content="image/jpeg"', 'content="image/png"')
  .replace('</head>', `<link rel="canonical" href="https://successpadel.app/coaching" />\n<meta name="description" content="${description}" />\n${page.css.map((file: string) => `<link rel="stylesheet" href="/${file}" />`).join('\n')}\n</head>`)
await mkdir('dist/coaching', { recursive: true })
await writeFile('dist/coaching/index.html', html)
console.log('Generated public coaching HTML from the shared page component')
