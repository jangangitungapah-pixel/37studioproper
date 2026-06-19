export const ONE_SIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '03b8a3dc-1adf-4dfd-8758-6fd0425d6d14';
export const ONE_SIGNAL_SAFARI_WEB_ID = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID || 'web.onesignal.auto.18c45a69-7bf7-46f8-9483-0a7df130c3b6';
export const ONE_SIGNAL_NATIVE_NOTIFY_BUTTON = true;
export const ONE_SIGNAL_WORKER_PATH = 'push/onesignal/OneSignalSDKWorker.js';
export const ONE_SIGNAL_WORKER_SCOPE = '/push/onesignal/';
export const ONE_SIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

let oneSignalInitPromise = null;
let oneSignalScriptPromise = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isLocalhost() {
  if (!isBrowser()) return false;

  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function getOneSignalDeferredQueue() {
  window.OneSignalDeferred = window.OneSignalDeferred || [];

  return window.OneSignalDeferred;
}

export function isOneSignalConfigured() {
  return Boolean(ONE_SIGNAL_APP_ID);
}

export function isOneSignalBrowserSupported() {
  if (!isBrowser()) return false;

  return (
    Boolean(ONE_SIGNAL_APP_ID) &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    (window.location.protocol === 'https:' || isLocalhost())
  );
}

export function getBrowserNotificationPermission() {
  if (!isBrowser() || !('Notification' in window)) return 'unsupported';

  return window.Notification.permission;
}

function loadOneSignalScript() {
  if (!isBrowser()) {
    return Promise.reject(new Error('OneSignal hanya bisa dimuat di browser.'));
  }

  if (window.OneSignal || window.OneSignalDeferred?.__loaded) {
    return Promise.resolve();
  }

  if (oneSignalScriptPromise) return oneSignalScriptPromise;

  oneSignalScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-onesignal-sdk="true"]');

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = ONE_SIGNAL_SDK_URL;
    script.defer = true;
    script.async = true;
    script.dataset.onesignalSdk = 'true';

    script.addEventListener('load', () => {
      window.OneSignalDeferred.__loaded = true;
      resolve();
    }, { once: true });

    script.addEventListener('error', () => {
      reject(new Error('Gagal memuat OneSignal SDK.'));
    }, { once: true });

    document.head.appendChild(script);
  });

  return oneSignalScriptPromise;
}

function runWithOneSignal(callback) {
  if (!isBrowser()) {
    return Promise.reject(new Error('OneSignal hanya bisa dipakai di browser.'));
  }

  return new Promise((resolve, reject) => {
    let didSettle = false;
    const timeoutId = window.setTimeout(() => {
      if (didSettle) return;

      didSettle = true;
      reject(new Error('OneSignal SDK timeout.'));
    }, 12000);

    getOneSignalDeferredQueue().push(async (OneSignal) => {
      if (didSettle) return;

      try {
        const result = await callback(OneSignal);
        didSettle = true;
        window.clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        didSettle = true;
        window.clearTimeout(timeoutId);
        reject(error);
      }
    });

    loadOneSignalScript().catch((error) => {
      if (didSettle) return;

      didSettle = true;
      window.clearTimeout(timeoutId);
      reject(error);
    });
  });
}

function isAlreadyInitializedError(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return message.includes('already') && message.includes('init');
}

function cleanTagValue(value) {
  return String(value || '').trim().slice(0, 120);
}

export async function initOneSignal() {
  if (!isOneSignalConfigured()) {
    return {
      configured: false,
      permission: getBrowserNotificationPermission(),
      subscriptionId: '',
      supported: false,
    };
  }

  if (!isOneSignalBrowserSupported()) {
    return {
      configured: true,
      permission: getBrowserNotificationPermission(),
      subscriptionId: '',
      supported: false,
    };
  }

  if (oneSignalInitPromise) return oneSignalInitPromise;

  oneSignalInitPromise = runWithOneSignal(async (OneSignal) => {
    try {
      await OneSignal.init({
        allowLocalhostAsSecureOrigin: true,
        appId: ONE_SIGNAL_APP_ID,
        autoResubscribe: true,
        notificationClickHandlerAction: 'focus',
        notificationClickHandlerMatch: 'origin',
        notifyButton: {
          enable: ONE_SIGNAL_NATIVE_NOTIFY_BUTTON,
        },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: 'push',
                autoPrompt: false,
                text: {
                  actionMessage: 'Aktifkan notifikasi untuk update booking, pembayaran, dan pesan studio.',
                  acceptButton: 'Aktifkan',
                  cancelButton: 'Nanti',
                },
              },
            ],
          },
        },
        safari_web_id: ONE_SIGNAL_SAFARI_WEB_ID,
        serviceWorkerParam: {
          scope: ONE_SIGNAL_WORKER_SCOPE,
        },
        serviceWorkerPath: ONE_SIGNAL_WORKER_PATH,
        welcomeNotification: {
          disable: true,
        },
      });
    } catch (error) {
      if (!isAlreadyInitializedError(error)) {
        throw error;
      }
    }

    return getOneSignalState();
  });

  return oneSignalInitPromise;
}

export async function getOneSignalState() {
  if (!isOneSignalConfigured() || !isBrowser()) {
    return {
      configured: false,
      permission: getBrowserNotificationPermission(),
      subscriptionId: '',
      supported: false,
    };
  }

  return runWithOneSignal(async (OneSignal) => {
    let supported = true;

    if (typeof OneSignal.Notifications?.isPushSupported === 'function') {
      supported = await OneSignal.Notifications.isPushSupported();
    }

    return {
      configured: true,
      externalId: OneSignal.User?.externalId || '',
      oneSignalId: OneSignal.User?.onesignalId || '',
      optedIn: Boolean(OneSignal.User?.PushSubscription?.optedIn),
      permission: OneSignal.Notifications?.permission || getBrowserNotificationPermission(),
      subscriptionId: OneSignal.User?.PushSubscription?.id || '',
      supported,
    };
  });
}

export async function identifyOneSignalUser(user, role = 'client') {
  if (!user?.uid || !isOneSignalConfigured()) {
    return null;
  }

  await initOneSignal();

  return runWithOneSignal(async (OneSignal) => {
    if (typeof OneSignal.login === 'function') {
      await OneSignal.login(user.uid);
    }

    if (typeof OneSignal.User?.addTags === 'function') {
      await OneSignal.User.addTags({
        app: '37_music_studio',
        email: cleanTagValue(user.email),
        role: cleanTagValue(role),
      });
    }

    return getOneSignalState();
  });
}

export async function logoutOneSignalUser() {
  if (!isOneSignalConfigured()) return null;

  await initOneSignal();

  return runWithOneSignal(async (OneSignal) => {
    if (typeof OneSignal.logout === 'function') {
      await OneSignal.logout();
    }

    return getOneSignalState();
  });
}

export async function requestOneSignalPushPermission(user, role = 'client') {
  await initOneSignal();

  const state = await runWithOneSignal(async (OneSignal) => {
    if (OneSignal.Notifications?.permission === true || getBrowserNotificationPermission() === 'granted') {
      return getOneSignalState();
    }

    if (typeof OneSignal.Notifications?.requestPermission === 'function') {
      await OneSignal.Notifications.requestPermission();
    }

    return getOneSignalState();
  });

  if (user?.uid && (state.permission === true || state.permission === 'granted')) {
    await identifyOneSignalUser(user, role);
  }

  return getOneSignalState();
}

export const oneSignalService = {
  getBrowserNotificationPermission,
  getOneSignalState,
  identifyOneSignalUser,
  initOneSignal,
  isOneSignalBrowserSupported,
  isOneSignalConfigured,
  logoutOneSignalUser,
  requestOneSignalPushPermission,
};
