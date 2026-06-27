import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

export const OPERATOR_FEE_SETTINGS_STORAGE_KEY = '37musicstudio.operator.fee.settings.v1';
export const OPERATOR_FEE_SETTINGS_DOC_PATH = ['settings', 'operatorFees'];

export const OPERATOR_FEE_PERSON_ROLES = {
  BOTH: 'both',
  GUARD: 'guard',
  RECORDING_OPERATOR: 'recording_operator',
};

export const OPERATOR_FEE_TARGET_TYPES = {
  MANUAL: 'manual',
  PACKAGE: 'package',
  RECORDING_TYPE: 'recordingType',
  SESSION: 'session',
};

export const OPERATOR_FEE_MATCH_MODES = {
  ANY: 'any',
  KEYWORD: 'keyword',
  TARGET_ID: 'targetId',
};

export const OPERATOR_FEE_CALCULATION_MODES = {
  DAILY: 'daily',
  FLAT: 'flat',
  HOURLY: 'hourly',
  OVERTIME_HOURLY: 'overtimeHourly',
  PER_BLOCK: 'perBlock',
  PERCENTAGE: 'percentage',
};

export const OPERATOR_FEE_POST_MODES = {
  MANUAL_REVIEW: 'manual-review',
};

export const DEFAULT_OPERATOR_FEE_SETTINGS = {
  people: [
    {
      id: 'guard-default',
      name: 'Penjaga Studio',
      role: OPERATOR_FEE_PERSON_ROLES.GUARD,
      active: true,
      defaultPaymentMethod: 'cash',
      note: 'Default penjaga studio.',
    },
    {
      id: 'recording-operator-default',
      name: 'Operator Recording',
      role: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
      active: true,
      defaultPaymentMethod: 'transfer',
      note: 'Default operator recording.',
    },
  ],
  rules: [
    {
      id: 'guard-rehearsal-hourly',
      name: 'Fee penjaga rehearsal',
      active: true,
      targetType: OPERATOR_FEE_TARGET_TYPES.SESSION,
      targetId: 'rehearsal',
      targetLabel: 'Rehearsal',
      matchMode: OPERATOR_FEE_MATCH_MODES.TARGET_ID,
      keyword: '',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.HOURLY,
      amount: 10000,
      percentage: 0,
      baseHours: 1,
      overtimeAfterHours: 0,
      referencePrice: 0,
      requireAssignedPerson: true,
      includeMeal: true,
      onlyForNoDurationPackage: false,
      bookkeepingCategory: 'crew',
      titleTemplate: 'Fee Penjaga - {bookingCode} - {serviceLabel}',
      note: 'Rp10.000 per jam untuk session Rehearsal.',
    },
    {
      id: 'guard-daily-meal',
      name: 'Uang makan penjaga',
      active: true,
      targetType: OPERATOR_FEE_TARGET_TYPES.MANUAL,
      targetId: 'meal',
      targetLabel: 'Uang makan',
      matchMode: OPERATOR_FEE_MATCH_MODES.ANY,
      keyword: '',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.DAILY,
      amount: 40000,
      percentage: 0,
      baseHours: 1,
      overtimeAfterHours: 0,
      referencePrice: 0,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      bookkeepingCategory: 'crew',
      titleTemplate: 'Uang Makan Penjaga - {date}',
      note: 'Default Rp40.000 per orang per hari aktif.',
    },
    {
      id: 'guard-recording-track-block',
      name: 'Komisi penjaga recording track',
      active: true,
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Track',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'track',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.PER_BLOCK,
      amount: 50000,
      percentage: 0,
      baseHours: 6,
      overtimeAfterHours: 6,
      referencePrice: 950000,
      requireAssignedPerson: true,
      includeMeal: true,
      onlyForNoDurationPackage: false,
      bookkeepingCategory: 'crew',
      titleTemplate: 'Komisi Penjaga Recording - {bookingCode}',
      note: 'Rp50.000 per 6 jam session recording track.',
    },
    {
      id: 'guard-recording-overtime',
      name: 'Overtime penjaga recording',
      active: true,
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Track Overtime',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'track',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.OVERTIME_HOURLY,
      amount: 10000,
      percentage: 0,
      baseHours: 1,
      overtimeAfterHours: 6,
      referencePrice: 0,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      bookkeepingCategory: 'crew',
      titleTemplate: 'Overtime Penjaga Recording - {bookingCode}',
      note: 'Rp10.000 per jam setelah durasi melewati 6 jam.',
    },
    {
      id: 'operator-recording-track',
      name: 'Fee operator recording track',
      active: true,
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Track',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'track',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.FLAT,
      amount: 450000,
      percentage: 0,
      baseHours: 6,
      overtimeAfterHours: 0,
      referencePrice: 950000,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      bookkeepingCategory: 'crew',
      titleTemplate: 'Fee Operator Recording Track - {bookingCode}',
      note: 'Default Rp450.000 dari harga sewa Rp950.000 / 6 jam.',
    },
    {
      id: 'operator-recording-live',
      name: 'Fee operator recording live',
      active: true,
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Live',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'live',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.FLAT,
      amount: 285000,
      percentage: 0,
      baseHours: 3,
      overtimeAfterHours: 0,
      referencePrice: 600000,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      bookkeepingCategory: 'crew',
      titleTemplate: 'Fee Operator Recording Live - {bookingCode}',
      note: 'Default Rp285.000 dari harga sewa Rp600.000 / 3 jam.',
    },
  ],
  options: {
    autoIncludeMeal: true,
    duplicateProtection: true,
    mealPerPersonPerDay: 40000,
    postMode: OPERATOR_FEE_POST_MODES.MANUAL_REVIEW,
  },
};

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function makeOperatorFeeId(prefix = 'operator-fee') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return prefix + '-' + crypto.randomUUID();
  }

  return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export function formatOperatorFeeCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Math.max(0, Number(value) || 0));
}

export function normalizeOperatorFeePerson(person) {
  const source = person && typeof person === 'object' ? person : {};

  return {
    id: cleanText(source.id, makeOperatorFeeId('person')),
    name: cleanText(source.name, 'Crew Studio'),
    role: [OPERATOR_FEE_PERSON_ROLES.GUARD, OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR, OPERATOR_FEE_PERSON_ROLES.BOTH].includes(source.role)
      ? source.role
      : OPERATOR_FEE_PERSON_ROLES.GUARD,
    active: source.active !== false,
    defaultPaymentMethod: cleanText(source.defaultPaymentMethod, 'cash'),
    note: cleanText(source.note),
  };
}

export function normalizeOperatorFeeRule(rule) {
  const source = rule && typeof rule === 'object' ? rule : {};

  return {
    id: cleanText(source.id, makeOperatorFeeId('rule')),
    name: cleanText(source.name, 'Rule Operator Fee'),
    active: source.active !== false,
    targetType: Object.values(OPERATOR_FEE_TARGET_TYPES).includes(source.targetType)
      ? source.targetType
      : OPERATOR_FEE_TARGET_TYPES.MANUAL,
    targetId: cleanText(source.targetId),
    targetLabel: cleanText(source.targetLabel, 'Target Fee'),
    matchMode: Object.values(OPERATOR_FEE_MATCH_MODES).includes(source.matchMode)
      ? source.matchMode
      : OPERATOR_FEE_MATCH_MODES.TARGET_ID,
    keyword: cleanLower(source.keyword),
    payeeRole: [OPERATOR_FEE_PERSON_ROLES.GUARD, OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR].includes(source.payeeRole)
      ? source.payeeRole
      : OPERATOR_FEE_PERSON_ROLES.GUARD,
    calculationMode: Object.values(OPERATOR_FEE_CALCULATION_MODES).includes(source.calculationMode)
      ? source.calculationMode
      : OPERATOR_FEE_CALCULATION_MODES.FLAT,
    amount: toNumber(source.amount),
    percentage: toNumber(source.percentage),
    baseHours: toNumber(source.baseHours, 1),
    overtimeAfterHours: toNumber(source.overtimeAfterHours),
    referencePrice: toNumber(source.referencePrice),
    requireAssignedPerson: source.requireAssignedPerson !== false,
    includeMeal: source.includeMeal === true,
    onlyForNoDurationPackage: source.onlyForNoDurationPackage === true,
    bookkeepingCategory: cleanText(source.bookkeepingCategory, 'crew'),
    titleTemplate: cleanText(source.titleTemplate, 'Operator Fee - {bookingCode} - {serviceLabel}'),
    note: cleanText(source.note),
  };
}

export function normalizeOperatorFeeOptions(options) {
  const source = options && typeof options === 'object' ? options : {};

  return {
    autoIncludeMeal: source.autoIncludeMeal !== false,
    duplicateProtection: source.duplicateProtection !== false,
    mealPerPersonPerDay: toNumber(source.mealPerPersonPerDay, 40000),
    postMode: Object.values(OPERATOR_FEE_POST_MODES).includes(source.postMode)
      ? source.postMode
      : OPERATOR_FEE_POST_MODES.MANUAL_REVIEW,
  };
}

export function normalizeOperatorFeeSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : DEFAULT_OPERATOR_FEE_SETTINGS;

  return {
    people: Array.isArray(source.people)
      ? source.people.map(normalizeOperatorFeePerson)
      : DEFAULT_OPERATOR_FEE_SETTINGS.people.map(normalizeOperatorFeePerson),
    rules: Array.isArray(source.rules)
      ? source.rules.map(normalizeOperatorFeeRule)
      : DEFAULT_OPERATOR_FEE_SETTINGS.rules.map(normalizeOperatorFeeRule),
    options: normalizeOperatorFeeOptions(source.options),
    updatedAt: cleanText(source.updatedAt),
    updatedByUid: cleanText(source.updatedByUid),
  };
}

function getBookingDurationHours(booking) {
  const duration = Number(booking?.durationHours || booking?.duration || booking?.customDuration || 0);

  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

function getBookingServiceLabel(booking) {
  return cleanText(
    booking?.packageLabel ||
    booking?.recordingTypeLabel ||
    booking?.sessionLabel ||
    booking?.title,
    'Booking Studio'
  );
}

function isNoDurationPackageBooking(booking) {
  const hasPackage = Boolean(booking?.packageId && booking.packageId !== 'none') || booking?.pricingMode === 'package';

  return hasPackage && getBookingDurationHours(booking) <= 0;
}

function matchesKeyword(rule, target) {
  const keyword = cleanLower(rule.keyword);

  if (!keyword) return false;

  return cleanLower(target.id + ' ' + target.label + ' ' + target.description).includes(keyword);
}

function buildTargetFromBooking(booking) {
  if ((booking?.packageId && booking.packageId !== 'none') || booking?.pricingMode === 'package') {
    return {
      id: cleanText(booking.packageId),
      label: cleanText(booking.packageLabel || booking.title, 'Paket Studio'),
      description: cleanText(booking.packageDetail),
      type: OPERATOR_FEE_TARGET_TYPES.PACKAGE,
    };
  }

  if (booking?.recordingTypeId && booking.recordingTypeId !== 'none') {
    return {
      id: cleanText(booking.recordingTypeId),
      label: cleanText(booking.recordingTypeLabel || booking.sessionLabel || booking.title, 'Recording Type'),
      description: cleanText(booking.recordingTypeDescription),
      type: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
    };
  }

  return {
    id: cleanText(booking?.sessionId || booking?.sessionType, 'rehearsal'),
    label: cleanText(booking?.sessionLabel || booking?.title, 'Session Studio'),
    description: cleanText(booking?.sessionDescription),
    type: OPERATOR_FEE_TARGET_TYPES.SESSION,
  };
}

export function doesOperatorFeeRuleMatchBooking(rule, booking) {
  const normalizedRule = normalizeOperatorFeeRule(rule);
  const target = buildTargetFromBooking(booking);

  if (!normalizedRule.active) return false;
  if (normalizedRule.onlyForNoDurationPackage && !isNoDurationPackageBooking(booking)) return false;
  if (normalizedRule.targetType !== OPERATOR_FEE_TARGET_TYPES.MANUAL && normalizedRule.targetType !== target.type) return false;
  if (normalizedRule.matchMode === OPERATOR_FEE_MATCH_MODES.ANY) return true;
  if (normalizedRule.matchMode === OPERATOR_FEE_MATCH_MODES.KEYWORD) return matchesKeyword(normalizedRule, target);

  return cleanText(normalizedRule.targetId) === cleanText(target.id);
}

export function calculateOperatorFeeRuleAmount(rule, booking) {
  const normalizedRule = normalizeOperatorFeeRule(rule);
  const durationHours = getBookingDurationHours(booking);
  const amount = toNumber(normalizedRule.amount);
  const baseHours = Math.max(1, toNumber(normalizedRule.baseHours, 1));
  const overtimeAfterHours = toNumber(normalizedRule.overtimeAfterHours);
  const bookingTotal = toNumber(booking?.total || booking?.subtotal || booking?.invoiceAmount);

  if (normalizedRule.calculationMode === OPERATOR_FEE_CALCULATION_MODES.HOURLY) {
    return Math.round(durationHours * amount);
  }

  if (normalizedRule.calculationMode === OPERATOR_FEE_CALCULATION_MODES.DAILY) {
    return amount;
  }

  if (normalizedRule.calculationMode === OPERATOR_FEE_CALCULATION_MODES.PER_BLOCK) {
    return Math.round(Math.max(1, Math.ceil(durationHours / baseHours)) * amount);
  }

  if (normalizedRule.calculationMode === OPERATOR_FEE_CALCULATION_MODES.OVERTIME_HOURLY) {
    return Math.round(Math.max(0, durationHours - overtimeAfterHours) * amount);
  }

  if (normalizedRule.calculationMode === OPERATOR_FEE_CALCULATION_MODES.PERCENTAGE) {
    return Math.round(bookingTotal * (toNumber(normalizedRule.percentage) / 100));
  }

  return amount;
}

function isBookingScopedOperatorFeeRule(rule) {
  return rule.calculationMode !== OPERATOR_FEE_CALCULATION_MODES.DAILY;
}

export function buildOperatorFeeTargetOptions(pricingSettings = {}) {
  const sessions = Array.isArray(pricingSettings.sessions) ? pricingSettings.sessions : [];
  const recordingTypes = Array.isArray(pricingSettings.recordingTypes) ? pricingSettings.recordingTypes : [];
  const packages = Array.isArray(pricingSettings.packages) ? pricingSettings.packages : [];

  return [
    ...sessions.map((item) => ({
      key: 'session:' + item.id,
      label: item.name || item.label || item.id,
      targetId: item.id,
      targetType: OPERATOR_FEE_TARGET_TYPES.SESSION,
    })),
    ...recordingTypes.map((item) => ({
      key: 'recordingType:' + item.id,
      label: item.name || item.label || item.id,
      targetId: item.id,
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
    })),
    ...packages.map((item) => ({
      key: 'package:' + item.id,
      label: item.name || item.label || item.id,
      targetId: item.id,
      targetType: OPERATOR_FEE_TARGET_TYPES.PACKAGE,
    })),
  ];
}

export function createEstimatedOperatorFeeLines({
  assignedPeopleByRole = {},
  booking,
  settings = getOperatorFeeSettings(),
} = {}) {
  const normalizedSettings = normalizeOperatorFeeSettings(settings);
  const target = buildTargetFromBooking(booking);
  const bookingCode = cleanText(booking?.bookingCode || booking?.bookingId || booking?.id, 'BKG');
  const serviceLabel = getBookingServiceLabel(booking);

  return normalizedSettings.rules
    .filter((rule) => doesOperatorFeeRuleMatchBooking(rule, booking))
    .filter(isBookingScopedOperatorFeeRule)
    .map((rule) => {
      const person = assignedPeopleByRole[rule.payeeRole] || null;
      const amount = calculateOperatorFeeRuleAmount(rule, booking);

      return {
        id: bookingCode + ':' + rule.id + ':' + (person?.id || rule.payeeRole),
        amount,
        bookingCode,
        bookingDate: cleanText(booking?.date),
        bookingId: cleanText(booking?.id || booking?.bookingId),
        calculationMode: rule.calculationMode,
        durationHours: getBookingDurationHours(booking),
        payeeRole: rule.payeeRole,
        personId: cleanText(person?.id),
        personName: cleanText(person?.name, rule.payeeRole === OPERATOR_FEE_PERSON_ROLES.GUARD ? 'Penjaga Studio' : 'Operator Recording'),
        ruleId: rule.id,
        ruleName: rule.name,
        serviceLabel,
        sourcePricingId: target.id,
        sourcePricingLabel: target.label,
        sourcePricingType: target.type,
        title: rule.titleTemplate
          .replace('{bookingCode}', bookingCode)
          .replace('{serviceLabel}', serviceLabel)
          .replace('{date}', cleanText(booking?.date)),
      };
    })
    .filter((line) => line.amount > 0);
}

let cachedOperatorFeeSettings = (() => {
  if (typeof window === 'undefined') {
    return normalizeOperatorFeeSettings(DEFAULT_OPERATOR_FEE_SETTINGS);
  }

  try {
    const raw = window.localStorage.getItem(OPERATOR_FEE_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : DEFAULT_OPERATOR_FEE_SETTINGS;

    return normalizeOperatorFeeSettings(parsed);
  } catch {
    return normalizeOperatorFeeSettings(DEFAULT_OPERATOR_FEE_SETTINGS);
  }
})();

export function getOperatorFeeSettings() {
  return cachedOperatorFeeSettings;
}

export async function saveOperatorFeeSettings(settings, meta = {}) {
  const normalized = normalizeOperatorFeeSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedByUid: cleanText(meta.updatedByUid || settings?.updatedByUid),
  });

  cachedOperatorFeeSettings = normalized;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(OPERATOR_FEE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Browser storage can fail in private or restricted contexts.
    }
  }

  if (isFirebaseConfigured && firestoreDb) {
    const docRef = doc(firestoreDb, ...OPERATOR_FEE_SETTINGS_DOC_PATH);
    await setDoc(docRef, normalized);
  }

  return normalized;
}

let listeners = [];
let isSubscribed = false;

export function subscribeOperatorFeeSettings(callback, onError) {
  listeners.push(callback);
  callback(cachedOperatorFeeSettings);

  if (!isSubscribed && isFirebaseConfigured && firestoreDb) {
    isSubscribed = true;
    const docRef = doc(firestoreDb, ...OPERATOR_FEE_SETTINGS_DOC_PATH);

    onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const remote = normalizeOperatorFeeSettings(docSnap.data());
          cachedOperatorFeeSettings = remote;

          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(OPERATOR_FEE_SETTINGS_STORAGE_KEY, JSON.stringify(remote));
            } catch {
              // Browser storage can fail in private or restricted contexts.
            }
          }

          listeners.forEach((listener) => {
            try {
              listener(remote);
            } catch (error) {
              console.error('Operator fee settings listener error:', error);
            }
          });
        } else {
          saveOperatorFeeSettings(cachedOperatorFeeSettings).catch((error) => {
            console.error('Failed to initialize operator fee settings:', error);
          });
        }
      },
      (error) => {
        console.error('Error in operator fee settings snapshot:', error);
        if (onError) onError(error);
      }
    );
  }

  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

export function useOperatorFeeSettings() {
  const [settings, setSettings] = useState(cachedOperatorFeeSettings);

  useEffect(() => subscribeOperatorFeeSettings(setSettings), []);

  return settings;
}
