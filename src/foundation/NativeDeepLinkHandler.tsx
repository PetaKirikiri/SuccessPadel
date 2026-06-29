import { useEffect } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNativeApp, oauthSearchFromDeepLink } from '../lib/native/app'

function routeOAuthReturn(url: string, navigate: NavigateFunction): boolean {
  const search = oauthSearchFromDeepLink(url)
  if (!search) return false
  void Browser.close()
  navigate(`/login${search}`, { replace: true })
  return true
}

export function NativeDeepLinkHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeApp()) return

    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) routeOAuthReturn(launch.url, navigate)
    })

    const listener = App.addListener('appUrlOpen', ({ url }) => {
      routeOAuthReturn(url, navigate)
    })

    return () => {
      void listener.then((handle) => handle.remove())
    }
  }, [navigate])

  return null
}
