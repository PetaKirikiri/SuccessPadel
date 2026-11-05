/** Narrow optimization of css-has-pseudo's legacy browser runtime.
 * Its repeated zoom workaround forces full-page layout on LG for every match.
 * Attribute changes already invalidate selectors; unchanged matches need no write.
 * Fail the build if the upstream implementation changes, rather than silently
 * losing either compatibility or this performance fix.
 */
export function optimizeTvCssRuntime(source) {
  const write = 't.setAttributeNode(n.children[0].attributes[0].cloneNode())'
  const zoom = ',e.documentElement.style.zoom=1,e.documentElement.style.zoom=null'
  if (!source.includes(write) || source.split(zoom).length !== 3) {
    throw new Error('css-has-pseudo runtime changed; review TV performance optimization')
  }
  return source.replace(write, '!t.hasAttribute(r.attributeName)&&'+write).split(zoom).join('')
}
export function tvCssRuntimePlugin() {
  return {
    name: 'success-padel-tv-css-runtime',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/css-has-pseudo/dist/browser.mjs')) return null
      return { code: optimizeTvCssRuntime(code), map: null }
    },
  }
}
