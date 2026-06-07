import type { CapacitorConfig } from '@capacitor/cli'

const devServerUrl = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'app.successpadel.club',
  appName: 'Success Padel',
  webDir: 'dist',
  server: devServerUrl
    ? {
        url: devServerUrl,
        cleartext: devServerUrl.startsWith('http://'),
      }
    : undefined,
  ios: {
    contentInset: 'automatic',
    scheme: 'Success Padel',
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
