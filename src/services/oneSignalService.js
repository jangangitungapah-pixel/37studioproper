export const ONE_SIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '03b8a3dc-1adf-4dfd-8758-6fd0425d6d14';
export const ONE_SIGNAL_SAFARI_WEB_ID = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID || 'web.onesignal.auto.18c45a69-7bf7-46f8-9483-0a7df130c3b6';
export const ONE_SIGNAL_NATIVE_NOTIFY_BUTTON = true;
export const ONE_SIGNAL_WORKER_PATH = 'push/onesignal/OneSignalSDKWorker.js';
export const ONE_SIGNAL_WORKER_SCOPE = '/push/onesignal/';
export const ONE_SIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

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

function markOneSignalScriptLoaded() {
  const script = document.querySelector('script[data-onesignal-sdk="true"]');

  if (script) {
    script.dataset.loaded = 'true';
  }

  if (window.OneSignalDeferred) {
    window.OneSignalDeferred.__loaded = true;
  }
}

function settleWithOneSignal(resolve) {
  if (!window.OneSignal) return false;

  oneSignalInstance = window.OneSignal;
  resolve(oneSignalInstance);
  return true;
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

  const existingScript = document.querySelector('script[data-onesignal-sdk="true"]');

  if (window.OneSignal || existingScript?.dataset.loaded === 'true') {
    return Promise.resolve();
  }

  if (oneSignalScriptPromise) return oneSignalScriptPromise;

  oneSignalScriptPromise = new Promise((resolve, reject) => {
    if (existingScript) {
      existingScript.addEventListener(
        'load',
        () => {
          markOneSignalScriptLoaded();
          resolve();
        },
        { once: true },
      );
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Gagal memuat OneSignal SDK.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = ONE_SIGNAL_SDK_URL;
    script.defer = true;
    script.async = true;
    script.dataset.onesignalSdk = 'true';

    script.addEventListener(
      'load',
      () => {
        markOneSignalScriptLoaded();
        resolve();
      },
      { once: true },
    );

    script.addEventListener(
      'error',
      () => {
        reject(new Error('Gagal memuat OneSignal SDK.'));
      },
      { once: true },
    );

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

    function settle(OneSignal) {
      if (didSettle) return;

      didSettle = true;
      window.clearTimeout(timeoutId);
      oneSignalInstance = OneSignal;
      resolve(OneSignal);
    }

    const timeoutId = window.setTimeout(() => {
      if (didSettle) return;

      didSettle = true;
      oneSignalInstancePromise = null;
      reject(new Error('OneSignal SDK timeout.'));
    }, 18000);

    getOneSignalDeferredQueue().push((OneSignal) => {
      settle(OneSignal);
    });

    loadOneSignalScript()
      .then(() => {
        window.setTimeout(() => {
          if (didSettle) return;
          settleWithOneSignal(settle);
        }, 0);
      })
      .catch((error) => {
        if (didSettle) return;

        didSettle = true;
        oneSignalInstancePromise = null;
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
    supported: isOneSignalBrowserSupported(),
  };
}

function buildUnsupportedState() {
  return {
    configured: isOneSignalConfigured(),
    permission: getBrowserNotificationPermission(),
    subscriptionId: '',
    supported: false,
  };
}

export async function initOneSignal() {
  if (!isOneSignalConfigured() || !isOneSignalBrowserSupported()) {
    return buildUnsupportedState();
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
  if (!isOneSignalConfigured() || !isBrowser() || !isOneSignalBrowserSupported()) {
    return buildUnsupportedState();
  }

  const OneSignal = await getOneSignalInstance();

  return buildOneSignalState(OneSignal);
}

export async function identifyOneSignalUser(_user, _role = 'client') {
  return initOneSignal();
}

export async function logoutOneSignalUser() {
  return getOneSignalState();
}

export async function requestOneSignalPushPermission(_user, _role = 'client') {
  await initOneSignal();

  const OneSignal = await getOneSignalInstance();
  const currentPermission = getPermissionFromOneSignal(OneSignal);

  if (currentPermission !== 'granted' && typeof OneSignal.Notifications?.requestPermission === 'function') {
    await OneSignal.Notifications.requestPermission();
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
