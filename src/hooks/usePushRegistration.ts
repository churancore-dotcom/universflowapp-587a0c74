// Registers the device with FCM (Capacitor Push Notifications) and
// stores the token in `device_tokens`. Also wires deep-link tap handling.
//
// IMPORTANT: PushNotifications.register() calls native Firebase code.
// If google-services.json / Firebase Gradle plugin are NOT in the Android
// build, register() throws a NATIVE exception that JS try/catch CANNOT
// catch, and the app process dies right after the user taps "Allow".
//
// To avoid bricking the app for users on a build without Firebase wired up,
// we:
//   1. Skip permanently if a previous attempt crashed (sticky flag).
//   2. Set a "pending" flag BEFORE calling register(); clear it on success.
//      If we see the flag still set on next launch, we know the previous
//      register() killed the process and we never try again.
//   3. Wrap everything in try/catch as a JS-side safety net.
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const isNative = () =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.() === true;

const PUSH_DISABLED_KEY = 'push_disabled_after_crash';
const PUSH_PENDING_KEY = 'push_register_pending';

export function usePushRegistration() {
  useEffect(() => {
    if (!isNative()) return;

    // If a previous register() killed the app, never try again on this device.
    try {
      if (localStorage.getItem(PUSH_DISABLED_KEY) === '1') {
        console.warn('[Push] Disabled — previous register() crashed the app.');
        return;
      }
      // If the pending flag is still set, the last attempt crashed natively.
      // Mark push as permanently disabled and bail out.
      if (localStorage.getItem(PUSH_PENDING_KEY) === '1') {
        localStorage.setItem(PUSH_DISABLED_KEY, '1');
        localStorage.removeItem(PUSH_PENDING_KEY);
        console.warn('[Push] Detected prior native crash — disabling push.');
        return;
      }
    } catch {}

    let cancelled = false;
    let removeListeners: Array<() => void> = [];

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 1) Permission
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') return;

        // 2) Register listeners FIRST so we catch registrationError
        const tokenListener = await PushNotifications.addListener('registration', async (t) => {
          if (cancelled) return;
          // Success — clear pending flag
          try { localStorage.removeItem(PUSH_PENDING_KEY); } catch {}
          const { data } = await supabase.auth.getUser();
          const uid = data?.user?.id;
          if (!uid) return;
          await supabase.from('device_tokens').upsert(
            {
              user_id: uid,
              token: t.value,
              platform: 'android',
              device_info: { ua: navigator.userAgent },
            },
            { onConflict: 'token' },
          );
        });
        removeListeners.push(() => tokenListener.remove());

        const errListener = await PushNotifications.addListener('registrationError', (e) => {
          console.warn('[Push] registrationError', e);
          try { localStorage.removeItem(PUSH_PENDING_KEY); } catch {}
        });
        removeListeners.push(() => errListener.remove());

        const recvListener = await PushNotifications.addListener(
          'pushNotificationReceived',
          () => {},
        );
        removeListeners.push(() => recvListener.remove());

        const actionListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const dl = (action.notification.data as any)?.deep_link;
            if (typeof dl === 'string' && dl.length > 0) {
              try {
                if (dl.startsWith('http')) {
                  window.location.href = dl;
                } else {
                  window.history.pushState({}, '', dl);
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              } catch (e) {
                console.warn('deep link nav failed', e);
              }
            }
          },
        );
        removeListeners.push(() => actionListener.remove());

        // 3) Set crash-tripwire flag, then call native register().
        // If register() crashes the process natively, the flag survives
        // and we'll permanently disable push on next launch.
        try { localStorage.setItem(PUSH_PENDING_KEY, '1'); } catch {}
        await PushNotifications.register();
        // If we got here, register() didn't crash synchronously. The flag
        // gets cleared in the 'registration' or 'registrationError' callback.
      } catch (e) {
        try { localStorage.removeItem(PUSH_PENDING_KEY); } catch {}
        console.warn('[Push] setup skipped:', e);
      }
    })();

    return () => {
      cancelled = true;
      removeListeners.forEach((fn) => {
        try { fn(); } catch {}
      });
    };
  }, []);
}
