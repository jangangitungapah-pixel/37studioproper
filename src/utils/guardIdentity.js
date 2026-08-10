export const GUARD_IDENTITY_LINK_STATES = Object.freeze({
  VALID: 'valid',
  MISSING_GUARD_ID: 'missing_guard_id',
  PERSON_NOT_FOUND: 'person_not_found',
  PERSON_INACTIVE: 'person_inactive',
  INVALID_PERSON_ROLE: 'invalid_person_role',
});

const GUARD_PERSON_ROLES = new Set([
  'guard',
  'both',
]);

function cleanGuardId(value) {
  return String(value || '').trim();
}

export function resolveGuardIdentityLink(
  people = [],
  guardId = '',
) {
  const normalizedGuardId = cleanGuardId(guardId);

  if (!normalizedGuardId) {
    return {
      guardId: '',
      isValid: false,
      person: null,
      state: GUARD_IDENTITY_LINK_STATES.MISSING_GUARD_ID,
    };
  }

  const person = (Array.isArray(people) ? people : [])
    .find((candidate) =>
      cleanGuardId(candidate?.id) === normalizedGuardId
    ) || null;

  if (!person) {
    return {
      guardId: normalizedGuardId,
      isValid: false,
      person: null,
      state: GUARD_IDENTITY_LINK_STATES.PERSON_NOT_FOUND,
    };
  }

  if (!GUARD_PERSON_ROLES.has(String(person.role || '').trim())) {
    return {
      guardId: normalizedGuardId,
      isValid: false,
      person,
      state: GUARD_IDENTITY_LINK_STATES.INVALID_PERSON_ROLE,
    };
  }

  if (person.active === false) {
    return {
      guardId: normalizedGuardId,
      isValid: false,
      person,
      state: GUARD_IDENTITY_LINK_STATES.PERSON_INACTIVE,
    };
  }

  return {
    guardId: normalizedGuardId,
    isValid: true,
    person,
    state: GUARD_IDENTITY_LINK_STATES.VALID,
  };
}

export function getGuardIdentityRepairMessage(linkOrState) {
  const state =
    typeof linkOrState === 'string'
      ? linkOrState
      : linkOrState?.state;

  if (state === GUARD_IDENTITY_LINK_STATES.MISSING_GUARD_ID) {
    return 'Akun Guard belum terhubung ke identitas crew. Hubungi Owner untuk menghubungkan akun dengan identitas crew.';
  }

  if (state === GUARD_IDENTITY_LINK_STATES.PERSON_NOT_FOUND) {
    return 'Identitas crew yang terhubung sudah tidak ditemukan. Hubungi Owner untuk menghubungkan ulang akun Guard.';
  }

  if (state === GUARD_IDENTITY_LINK_STATES.PERSON_INACTIVE) {
    return 'Identitas crew Guard sedang nonaktif. Hubungi Owner untuk mengaktifkan crew atau menghubungkan ulang akun.';
  }

  if (state === GUARD_IDENTITY_LINK_STATES.INVALID_PERSON_ROLE) {
    return 'Identitas crew yang terhubung bukan Guard/Both. Hubungi Owner untuk memperbaiki link akun.';
  }

  return '';
}

export function assertValidGuardIdentityLink(
  people = [],
  guardId = '',
) {
  const link = resolveGuardIdentityLink(people, guardId);

  if (!link.isValid) {
    if (link.state === GUARD_IDENTITY_LINK_STATES.MISSING_GUARD_ID) {
      throw new Error(
        'Pilih identitas crew penjaga sebelum mengubah role menjadi Guard.',
      );
    }

    throw new Error(
      getGuardIdentityRepairMessage(link) ||
      'Identitas crew Guard tidak valid.',
    );
  }

  return link;
}
