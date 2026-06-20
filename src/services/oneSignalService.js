export const ONE_SIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '03b8a3dc-1adf-4dfd-8758-6fd0425d6d14';
export const ONE_SIGNAL_SAFARI_WEB_ID = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID || 'web.onesignal.auto.18c45a69-7bf7-46f8-9483-0a7df130c3b6';
export const ONE_SIGNAL_NATIVE_NOTIFY_BUTTON = true;
export const ONE_SIGNAL_USE_EXTERNAL_ID_LOGIN = false;
export const ONE_SIGNAL_WORKER_PATH = 'push/onesignal/OneSignalSDKWorker.js';
export const ONE_SIGNAL_WORKER_SCOPE = '/push/onesignal/';
export const ONE_SIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

const TAG_SYNC_DELAYS_MS = [4500, 14000, 32000];

let oneSignalScriptPromise = null;
let oneSignalInstancePromise = null;
let oneSignalInitPromise = null;
let oneSignalInstance = null;

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

function getTagSyncStore() {
  window.__studio37OneSignalTagSync = window.__studio37OneSignalTagSync || {
    keys: new Set(),
    timers: new Map(),
  };

  return window.__studio37OneSignalTagSync;
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

function markOneSignalScriptLoaded() {
  const script = document.querySelector('script[data-onesignal-sdk="true"]');

  if (script) {
    script.dataset.loaded = 'true';
  }

  if (window.OneSignalDeferred) {
    window.OneSignalDeferred.__loaded = true;
  }
}

function loadOneSignalScript() {
  if (!isBrowser()) {
    return Promise.reject(new Error('OneSignal hanya bisa dimuat di browser.'));
  }

  const existingScript = document.querySelector('script[data-onesignal-sdk="true"]');

  if (window.OneSignal || existingScript?.dataset.loaded === 'true') {
    return Promise.resolve();
  }

  if (oneSignalScriptPromise) return oneSignalScriptPromise;

  oneSignalScriptPromise = new Promise((resolve, reject) => {
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        markOneSignalScriptLoaded();
        resolve();
      }, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Gagal memuat OneSignal SDK.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = ONE_SIGNAL_SDK_URL;
    script.defer = true;
    script.async = true;
    script.dataset.onesignalSdk = 'true';

    script.addEventListener('load', () => {
      markOneSignalScriptLoaded();
      resolve();
    }, { once: true });

    script.addEventListener('error', () => {
      reject(new Error('Gagal memuat OneSignal SDK.'));
    }, { once: true });

    document.head.appendChild(script);
  });

  return oneSignalScriptPromise;
}

function getOneSignalInstance() {
  if (!isBrowser()) {
    return Promise.reject(new Error('OneSignal hanya bisa dipakai di browser.'));
  }

  if (oneSignalInstance) return Promise.resolve(oneSignalInstance);

  if (window.OneSignal) {
    oneSignalInstance = window.OneSignal;
    return Promise.resolve(oneSignalInstance);
  }

  if (oneSignalInstancePromise) return oneSignalInstancePromise;

  oneSignalInstancePromise = new Promise((resolve, reject) => {
    let didSettle = false;
    const timeoutId = window.setTimeout(() => {
      if (didSettle) return;

      didSettle = true;
      reject(new Error('OneSignal SDK timeout.'));
    }, 18000);

    getOneSignalDeferredQueue().push((OneSignal) => {
      if (didSettle) return;

      didSettle = true;
      oneSignalInstance = OneSignal;
      window.clearTimeout(timeoutId);
      resolve(OneSignal);
    });

    loadOneSignalScript().catch((error) => {
      if (didSettle) return;

      didSettle = true;
      window.clearTimeout(timeoutId);
      reject(error);
    });
  });

  return oneSignalInstancePromise;
}

function isAlreadyInitializedError(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return message.includes('already') && message.includes('init');
}

function cleanTagValue(value) {
  return String(value || '').trim().slice(0, 120);
}

function getPermissionFromOneSignal(OneSignal) {
  const permission = OneSignal?.Notifications?.permission;

  if (permission === true) return 'granted';
  if (permission === false) return getBrowserNotificationPermission();

  return permission || getBrowserNotificationPermission();
}

function buildOneSignalState(OneSignal) {
  return {
    configured: isOneSignalConfigured(),
    externalId: OneSignal?.User?.externalId || '',
    oneSignalId: OneSignal?.User?.onesignalId || '',
    optedIn: Boolean(OneSignal?.User?.PushSubscription?.optedIn),
    permission: getPermissionFromOneSignal(OneSignal),
    subscriptionId: OneSignal?.User?.PushSubscription?.id || '',
    supported: true,
  };
}

function buildUserTags(user, role) {
  return {
    app: '37_music_studio',
    email: cleanTagValue(user?.email),
    role: cleanTagValue(role),
    uid: cleanTagValue(user?.uid),
  };
}

function getTagSyncKey(tags) {
  return [tags.uid, tags.role, tags.email].filter(Boolean).join('|');
}

async function syncOneSignalTagsNow(tags, attemptIndex) {
  const OneSignal = await getOneSignalInstance();

  if (typeof OneSignal.User?.addTags !== 'function') {
    return buildOneSignalState(OneSignal);
  }

  try {
    await OneSignal.User.addTags(tags);

    const store = getTagSyncStore();
    store.keys.add(getTagSyncKey(tags));

    return buildOneSignalState(OneSignal);
  } catch (error) {
    const message = String(error?.message || error || '');
    console.warn('[onesignal] Tag sync postponed:', {
      attempt: attemptIndex + 1,
      message,
    });

    return buildOneSignalState(OneSignal);
  }
}

function scheduleOneSignalTagSync(user, role = 'client') {
  if (!isBrowser() || !user?.uid || !isOneSignalConfigured()) return null;

  const tags = buildUserTags(user, role);
  const key = getTagSyncKey(tags);
  const store = getTagSyncStore();

  if (!key || store.keys.has(key)) {
    return null;
  }

  const existingTimers = store.timers.get(key) || [];
  existingTimers.forEach((timerId) => window.clearTimeout(timerId));

  const nextTimers = TAG_SYNC_DELAYS_MS.map((delay, attemptIndex) => {
    return window.setTimeout(() => {
      syncOneSignalTagsNow(tags, attemptIndex).catch((error) => {
        console.warn('[onesignal] Deferred tag sync failed:', error);
      });
    }, delay);
  });

  store.timers.set(key, nextTimers);

  return buildOneSignalState(oneSignalInstance);
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

  oneSignalInitPromise = (async () => {
    const OneSignal = await getOneSignalInstance();

    try {
      if (!window.__studio37OneSignalInitialized) {
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

        window.__studio37OneSignalInitialized = true;
      }
    } catch (error) {
      if (!isAlreadyInitializedError(error)) {
        oneSignalInitPromise = null;
        throw error;
      }

      window.__studio37OneSignalInitialized = true;
    }

    return buildOneSignalState(OneSignal);
  })();

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

  if (!isOneSignalBrowserSupported()) {
    return {
      configured: true,
      permission: getBrowserNotificationPermission(),
      subscriptionId: '',
      supported: false,
    };
  }

  const OneSignal = await getOneSignalInstance();

  return buildOneSignalState(OneSignal);
}

export async function identifyOneSignalUser(user, role = 'client') {
  if (!user?.uid || !isOneSignalConfigured()) {
    return null;
  }

  await initOneSignal();

  const OneSignal = await getOneSignalInstance();

  if (ONE_SIGNAL_USE_EXTERNAL_ID_LOGIN && typeof OneSignal.login === 'function') {
    await OneSignal.login(user.uid);
  }

  scheduleOneSignalTagSync(user, role);

  return buildOneSignalState(OneSignal);
}

export async function logoutOneSignalUser() {
  if (!isOneSignalConfigured()) return null;

  await initOneSignal();

  const OneSignal = await getOneSignalInstance();

  if (ONE_SIGNAL_USE_EXTERNAL_ID_LOGIN && typeof OneSignal.logout === 'function') {
    await OneSignal.logout();
  }

  if (typeof OneSignal.User?.removeTags === 'function') {
    try {
      await OneSignal.User.removeTags(['uid', 'email', 'role']);
    } catch (error) {
      console.warn('[onesignal] Remove tags failed:', error);
    }
  }

  return buildOneSignalState(OneSignal);
}

export async function requestOneSignalPushPermission(user, role = 'client') {
  await initOneSignal();

  const OneSignal = await getOneSignalInstance();

  const currentPermission = getPermissionFromOneSignal(OneSignal);

  if (currentPermission !== 'granted' && typeof OneSignal.Notifications?.requestPermission === 'function') {
    await OneSignal.Notifications.requestPermission();
  }

  const nextState = buildOneSignalState(OneSignal);

  if (user?.uid && nextState.permission === 'granted') {
    scheduleOneSignalTagSync(user, role);
  }

  return buildOneSignalState(OneSignal);
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
