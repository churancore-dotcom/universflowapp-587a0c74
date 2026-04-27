// Registers the device with FCM (Capacitor Push Notifications) and
// stores the token in `device_tokens`. Also wires deep-link tap handling.
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const isNative = () =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.() === true;

export function usePushRegistration() {
  useEffect(() => {
    if (!isNative()) return;

    let cancelled = false;
    let removeListeners: Array<() => void> = [];

    (async () => {
      try {
        // Dynamic import so web build doesn't break
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 1) Permission
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') return;

        // 2) Register
        await PushNotifications.register();

        // 3) On token, persist to backend
        const tokenListener = await PushNotifications.addListener('registration', async (t) => {
          if (cancelled) return;
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
          console.warn('Push registration error', e);
        });
        removeListeners.push(() => errListener.remove());

        // 4) Foreground notification — silently received; nothing to do
        const recvListener = await PushNotifications.addListener(
          'pushNotificationReceived',
          () => {},
        );
        removeListeners.push(() => recvListener.remove());

        // 5) Tap handling — deep link
        const actionListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const dl = (action.notification.data as any)?.deep_link;
            if (typeof dl === 'string' && dl.length > 0) {
              try {
                if (dl.startsWith('http')) {
                  window.location.href = dl;
                } else {
                  window.location.hash = ''; // no hash routing
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
      } catch (e) {
        console.warn('Push setup skipped:', e);
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
