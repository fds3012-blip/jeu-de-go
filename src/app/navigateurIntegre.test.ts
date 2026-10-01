import { describe, expect, it } from 'vitest';
import { aideNavigateur, contexteNavigateur, googleVisible, lienChrome } from './navigateurIntegre';

// #354 : agents utilisateurs réels (relevés sur appareils et dans les journaux publics des éditeurs).
const UA = {
  messengerIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/fr_FR;FBOP/5]',
  messengerAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/455.0.0.36.107;]',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/459.0.0.48.110;FBBV/584117445;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.4.1;FBSS/3;FBID/phone;FBLC/fr_FR;FBOP/5;FBRV/0]',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.105 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/454.0.0.44.108;]',
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 325.0.3.20.105 (iPhone14,2; iOS 17_4; fr_FR; fr; scale=3.00; 1170x2532; 584113264)',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36 Instagram 317.0.0.34.109 Android (33/13; 450dpi; 1080x2186; samsung; SM-A536B; a53x; s5e8825; fr_FR; 562739837)',
  tiktokAndroid: 'Mozilla/5.0 (Linux; Android 12; 2201117TG Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 trill_330604 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/33.6.4 ByteLocale/fr ByteFullLocale/fr Region/FR BytedanceWebview/d8a21c6',
  tiktokIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_33.6.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/fr Region/FR isDarkMode/0 WKWebView/1 RevealType/Dialog BytedanceWebview/d8a21c6',
  snapchatIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.80.0.40 (like Safari/8617.2.4.10.8, panda)',
  lineAndroid: 'Mozilla/5.0 (Linux; Android 13; SO-51C Build/64.1.C.0.250; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Line/13.21.1/IAB',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsungAndroid: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  ipadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
};

describe('navigateurs intégrés : Google caché', () => {
  for (const nom of ['messengerIos', 'messengerAndroid', 'facebookIos', 'facebookAndroid', 'instagramIos', 'instagramAndroid', 'tiktokAndroid', 'tiktokIos', 'snapchatIos', 'lineAndroid'] as const) {
    it(nom, () => {
      const c = contexteNavigateur({ userAgent: UA[nom] });
      expect(c.integre).toBe(true);
      expect(googleVisible(c, true)).toBe(false);
      expect(aideNavigateur(c, true)).toBe(nom.endsWith('Ios') ? 'ios' : 'android');
    });
  }
});

describe('navigateurs normaux : Google montré', () => {
  for (const nom of ['safariIos', 'chromeIos', 'chromeAndroid', 'samsungAndroid', 'chromeMac', 'firefoxWindows'] as const) {
    it(nom, () => {
      const c = contexteNavigateur({ userAgent: UA[nom] });
      expect(c.integre).toBe(false);
      expect(googleVisible(c, true)).toBe(true);
      expect(aideNavigateur(c, true)).toBeNull();
    });
  }
  it('iPad qui se déclare Mac (MacIntel + écran tactile) : iOS', () => {
    expect(contexteNavigateur({ userAgent: UA.ipadSafari, platform: 'MacIntel', maxTouchPoints: 5 }).os).toBe('ios');
    expect(contexteNavigateur({ userAgent: UA.chromeMac, platform: 'MacIntel', maxTouchPoints: 0 }).os).toBe('autre');
  });
});

describe('app installée', () => {
  it('sur iPhone : pas de Google (la session reviendrait dans Safari), pas d’aide', () => {
    const c = contexteNavigateur({ userAgent: UA.safariIos, installee: true });
    expect(c.appIos).toBe(true);
    expect(googleVisible(c, true)).toBe(false);
    expect(aideNavigateur(c, true)).toBeNull();
  });
  it('sur Android : Google reste (Chrome rouvre l’app installée)', () => {
    const c = contexteNavigateur({ userAgent: UA.chromeAndroid, installee: true });
    expect(googleVisible(c, true)).toBe(true);
  });
});

describe('activation et sessions', () => {
  it('rien sans VITE_AUTH_GOOGLE, ni aide', () => {
    expect(googleVisible(contexteNavigateur({ userAgent: UA.chromeAndroid }), false)).toBe(false);
    expect(aideNavigateur(contexteNavigateur({ userAgent: UA.messengerIos }), false)).toBeNull();
  });
  it('ancienne session anonyme : pas de Google (il faudrait linkIdentity)', () => {
    expect(googleVisible(contexteNavigateur({ userAgent: UA.chromeAndroid }), true, true)).toBe(false);
  });
});

describe('lien vers Chrome (Android)', () => {
  it('intent:// avec repli sur la page, sans fragment', () => {
    expect(lienChrome('https://jeu-de-go.vercel.app/?lang=en#acces')).toBe(
      'intent://jeu-de-go.vercel.app/?lang=en#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fjeu-de-go.vercel.app%2F%3Flang%3Den;end');
  });
});
