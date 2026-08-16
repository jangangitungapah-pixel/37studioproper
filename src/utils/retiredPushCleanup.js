const RETIRED_PUSH_SCOPE_PREFIX = '/push/';

export async function cleanupRetiredPushWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return 0;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  const retiredRegistrations = registrations.filter((registration) => {
    try {
      return new URL(registration.scope).pathname.startsWith(RETIRED_PUSH_SCOPE_PREFIX);
    } catch {
      return false;
    }
  });

  const results = await Promise.all(
    retiredRegistrations.map((registration) => registration.unregister()),
  );

  return results.filter(Boolean).length;
}
