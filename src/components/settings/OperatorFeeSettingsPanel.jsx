import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Save, Trash2, WalletCards } from 'lucide-react';
import StudioSelect from '../ui/StudioSelect.jsx';
import StudioTextField from '../ui/StudioTextField.jsx';
import { usePricingSettings } from '../../settings/pricingSettings.js';
import {
  DEFAULT_OPERATOR_FEE_SETTINGS,
  OPERATOR_FEE_CALCULATION_MODES,
  OPERATOR_FEE_MATCH_MODES,
  OPERATOR_FEE_PERSON_ROLES,
  OPERATOR_FEE_TARGET_TYPES,
  buildOperatorFeeTargetOptions,
  formatOperatorFeeCurrency,
  makeOperatorFeeId,
  normalizeOperatorFeeSettings,
  saveOperatorFeeSettings,
  useOperatorFeeSettings,
} from '../../settings/operatorFeeSettings.js';

const roleOptions = [
  { key: OPERATOR_FEE_PERSON_ROLES.GUARD, label: 'Penjaga Studio', description: 'Crew yang jaga studio.' },
  { key: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR, label: 'Operator Recording', description: 'Operator recording.' },
  { key: OPERATOR_FEE_PERSON_ROLES.BOTH, label: 'Bisa Keduanya', description: 'Bisa jadi penjaga atau operator.' },
];

const paymentMethodOptions = [
  { key: 'cash', label: 'Cash', description: 'Bayar tunai.' },
  { key: 'transfer', label: 'Transfer', description: 'Transfer bank/e-wallet.' },
  { key: 'qris', label: 'QRIS', description: 'QRIS.' },
  { key: 'other', label: 'Lainnya', description: 'Metode lain.' },
];

const payeeOptions = [
  { key: OPERATOR_FEE_PERSON_ROLES.GUARD, label: 'Penjaga', description: 'Fee masuk ke penjaga studio.' },
  { key: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR, label: 'Operator', description: 'Fee masuk ke operator recording.' },
];

const simpleCalculationOptions = [
  { key: OPERATOR_FEE_CALCULATION_MODES.FLAT, label: 'Flat', description: 'Nominal tetap per booking.' },
  { key: OPERATOR_FEE_CALCULATION_MODES.HOURLY, label: 'Per Jam', description: 'Durasi booking x nominal.' },
  { key: OPERATOR_FEE_CALCULATION_MODES.PER_BLOCK, label: 'Per Block', description: 'Per kelipatan jam dasar.' },
];

const simpleFeeControls = [
  {
    id: 'guard-rehearsal-hourly',
    label: 'Penjaga Rehearsal',
    helper: 'Per jam',
    defaultAmount: 10000,
    rule: {
      name: 'Fee Penjaga Rehearsal',
      targetType: OPERATOR_FEE_TARGET_TYPES.SESSION,
      targetId: 'rehearsal',
      targetLabel: 'Rehearsal',
      matchMode: OPERATOR_FEE_MATCH_MODES.TARGET_ID,
      keyword: '',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.HOURLY,
      baseHours: 1,
      overtimeAfterHours: 0,
      referencePrice: 0,
      requireAssignedPerson: true,
      includeMeal: true,
      onlyForNoDurationPackage: false,
      titleTemplate: 'Fee Penjaga - {bookingCode} - {serviceLabel}',
      note: 'Fee penjaga studio per jam rehearsal.',
    },
  },
  {
    id: 'guard-daily-meal',
    label: 'Uang Makan Penjaga',
    helper: 'Per orang / hari',
    defaultAmount: 40000,
    isMeal: true,
    rule: {
      name: 'Uang Makan Penjaga',
      targetType: OPERATOR_FEE_TARGET_TYPES.MANUAL,
      targetId: 'meal',
      targetLabel: 'Uang makan',
      matchMode: OPERATOR_FEE_MATCH_MODES.ANY,
      keyword: '',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.DAILY,
      baseHours: 1,
      overtimeAfterHours: 0,
      referencePrice: 0,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      titleTemplate: 'Uang Makan Penjaga - {date}',
      note: 'Uang makan penjaga studio.',
    },
  },
  {
    id: 'guard-recording-track-block',
    label: 'Penjaga Recording Track',
    helper: 'Per 6 jam session',
    defaultAmount: 50000,
    rule: {
      name: 'Komisi Penjaga Recording Track',
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Track',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'track',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.PER_BLOCK,
      baseHours: 6,
      overtimeAfterHours: 6,
      referencePrice: 950000,
      requireAssignedPerson: true,
      includeMeal: true,
      onlyForNoDurationPackage: false,
      titleTemplate: 'Komisi Penjaga Recording - {bookingCode}',
      note: 'Komisi penjaga untuk recording track.',
    },
  },
  {
    id: 'guard-recording-overtime',
    label: 'Overtime Penjaga',
    helper: 'Per jam overtime',
    defaultAmount: 10000,
    rule: {
      name: 'Overtime Penjaga Recording',
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Overtime',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'track',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.OVERTIME_HOURLY,
      baseHours: 1,
      overtimeAfterHours: 6,
      referencePrice: 0,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      titleTemplate: 'Overtime Penjaga Recording - {bookingCode}',
      note: 'Overtime penjaga recording.',
    },
  },
  {
    id: 'operator-recording-track',
    label: 'Operator Recording Track',
    helper: 'Per session',
    defaultAmount: 450000,
    rule: {
      name: 'Fee Operator Recording Track',
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Track',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'track',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.FLAT,
      baseHours: 6,
      overtimeAfterHours: 0,
      referencePrice: 950000,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      titleTemplate: 'Fee Operator Recording Track - {bookingCode}',
      note: 'Fee operator recording track.',
    },
  },
  {
    id: 'operator-recording-live',
    label: 'Operator Recording Live',
    helper: 'Per session',
    defaultAmount: 285000,
    rule: {
      name: 'Fee Operator Recording Live',
      targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE,
      targetId: '',
      targetLabel: 'Recording Live',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'live',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.FLAT,
      baseHours: 3,
      overtimeAfterHours: 0,
      referencePrice: 600000,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: false,
      titleTemplate: 'Fee Operator Recording Live - {bookingCode}',
      note: 'Fee operator recording live.',
    },
  },
  {
    id: 'operator-package-flat',
    label: 'Paket Mixing / Mastering',
    helper: 'Flat per paket',
    defaultAmount: 50000,
    rule: {
      name: 'Fee Paket Mixing / Mastering',
      targetType: OPERATOR_FEE_TARGET_TYPES.PACKAGE,
      targetId: '',
      targetLabel: 'Paket Mixing / Mastering',
      matchMode: OPERATOR_FEE_MATCH_MODES.KEYWORD,
      keyword: 'mixing',
      payeeRole: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
      calculationMode: OPERATOR_FEE_CALCULATION_MODES.FLAT,
      baseHours: 1,
      overtimeAfterHours: 0,
      referencePrice: 0,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: true,
      titleTemplate: 'Fee Paket - {bookingCode} - {serviceLabel}',
      note: 'Fee flat untuk paket mixing/mastering tanpa blok kalender.',
    },
  },
];

const simpleFeeIds = new Set(simpleFeeControls.map((control) => control.id));

const emptyPersonForm = {
  id: '',
  name: '',
  role: OPERATOR_FEE_PERSON_ROLES.GUARD,
  defaultPaymentMethod: 'cash',
};

const emptyCustomRuleForm = {
  targetKey: 'none',
  payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
  calculationMode: OPERATOR_FEE_CALCULATION_MODES.FLAT,
  amount: '',
};

function toNumberInput(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getRoleLabel(role) {
  return roleOptions.find((item) => item.key === role)?.label || role || '-';
}

function getRuleTemplate(control) {
  const defaultRule = DEFAULT_OPERATOR_FEE_SETTINGS.rules.find((rule) => rule.id === control.id);

  return {
    ...(defaultRule || {}),
    ...(control.rule || {}),
    id: control.id,
    active: true,
    amount: control.defaultAmount,
    percentage: 0,
    bookkeepingCategory: 'crew',
  };
}

function upsertRuleById(rules, control, patch) {
  const exists = rules.some((rule) => rule.id === control.id);
  const baseRule = getRuleTemplate(control);

  if (exists) {
    return rules.map((rule) => (
      rule.id === control.id
        ? {
          ...baseRule,
          ...rule,
          ...patch,
        }
        : rule
    ));
  }

  return [
    ...rules,
    {
      ...baseRule,
      ...patch,
    },
  ];
}

function getRuleAmount(settings, control) {
  if (control.isMeal) {
    return Number(settings.options.mealPerPersonPerDay || 0);
  }

  const rule = settings.rules.find((item) => item.id === control.id);

  return Number(rule?.amount ?? control.defaultAmount ?? 0);
}

function isRuleActive(settings, control) {
  const rule = settings.rules.find((item) => item.id === control.id);

  return rule ? rule.active !== false : true;
}

function getCustomRules(settings) {
  return settings.rules.filter((rule) => !simpleFeeIds.has(rule.id));
}

function getCustomRuleTitle(target) {
  return 'Fee ' + (target?.label || 'Custom Booking');
}

function createCustomTargetOptions(targetOptions) {
  return [
    { key: 'none', label: 'Pilih booking/session', description: 'Ambil dari Pricing Settings.' },
    ...targetOptions.map((item) => ({
      ...item,
      label: item.label,
      description: item.targetType + ' · otomatis cocok dengan booking',
    })),
  ];
}

export default function OperatorFeeSettingsPanel({ currentUser }) {
  const remoteOperatorFeeSettings = useOperatorFeeSettings();
  const pricingSettings = usePricingSettings();
  const [draft, setDraft] = useState(() => normalizeOperatorFeeSettings(remoteOperatorFeeSettings));
  const [personForm, setPersonForm] = useState(emptyPersonForm);
  const [customRuleForm, setCustomRuleForm] = useState(emptyCustomRuleForm);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraft(normalizeOperatorFeeSettings(remoteOperatorFeeSettings));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [remoteOperatorFeeSettings]);

  const targetOptions = useMemo(() => buildOperatorFeeTargetOptions(pricingSettings), [pricingSettings]);
  const customTargetOptions = useMemo(() => createCustomTargetOptions(targetOptions), [targetOptions]);
  const activePeople = draft.people.filter((person) => person.active);
  const activeSimpleRules = simpleFeeControls.filter((control) => isRuleActive(draft, control));
  const customRules = getCustomRules(draft);
  const estimatedMonthlyBase = simpleFeeControls.reduce((total, control) => total + getRuleAmount(draft, control), 0);

  function updateSimpleAmount(control, value) {
    const amount = toNumberInput(value);

    setDraft((current) => {
      const normalized = normalizeOperatorFeeSettings(current);
      const nextRules = upsertRuleById(normalized.rules, control, { amount });

      return normalizeOperatorFeeSettings({
        ...normalized,
        rules: nextRules,
        options: {
          ...normalized.options,
          mealPerPersonPerDay: control.isMeal ? amount : normalized.options.mealPerPersonPerDay,
        },
      });
    });

    if (message) setMessage('');
  }

  function toggleSimpleRule(control, checked) {
    setDraft((current) => {
      const normalized = normalizeOperatorFeeSettings(current);

      return normalizeOperatorFeeSettings({
        ...normalized,
        rules: upsertRuleById(normalized.rules, control, { active: checked }),
      });
    });

    if (message) setMessage('');
  }

  function updatePersonField(field) {
    return (event) => {
      const value = event.target.value;
      setPersonForm((current) => ({
        ...current,
        [field]: value,
      }));
      if (message) setMessage('');
    };
  }

  function updatePersonValue(field) {
    return (nextValue) => {
      setPersonForm((current) => ({
        ...current,
        [field]: nextValue,
      }));
      if (message) setMessage('');
    };
  }

  function updateCustomRuleValue(field) {
    return (nextValue) => {
      setCustomRuleForm((current) => ({
        ...current,
        [field]: nextValue,
      }));
      if (message) setMessage('');
    };
  }

  function updateCustomRuleAmount(event) {
    const value = event.target.value;

    setCustomRuleForm((current) => ({
      ...current,
      amount: value,
    }));

    if (message) setMessage('');
  }

  function savePerson(event) {
    event.preventDefault();

    const cleanName = personForm.name.trim();

    if (!cleanName) {
      setMessage('Nama crew belum diisi.');
      return;
    }

    const person = {
      id: personForm.id || makeOperatorFeeId('person'),
      name: cleanName,
      role: personForm.role,
      active: true,
      defaultPaymentMethod: personForm.defaultPaymentMethod,
      note: '',
    };

    setDraft((current) => normalizeOperatorFeeSettings({
      ...current,
      people: [...current.people.filter((item) => item.id !== person.id), person],
    }));

    setPersonForm(emptyPersonForm);
    setMessage('Crew ditambahkan. Jangan lupa klik Simpan Settings.');
  }

  function deletePerson(personId) {
    setDraft((current) => normalizeOperatorFeeSettings({
      ...current,
      people: current.people.filter((person) => person.id !== personId),
    }));

    if (message) setMessage('');
  }

  function addCustomRule(event) {
    event.preventDefault();

    const target = targetOptions.find((item) => item.key === customRuleForm.targetKey);
    const amount = toNumberInput(customRuleForm.amount);

    if (!target) {
      setMessage('Pilih target booking dulu.');
      return;
    }

    if (!amount) {
      setMessage('Isi nominal rules baru.');
      return;
    }

    const id = 'custom-' + target.key.replace(/[^a-zA-Z0-9_-]/g, '_') + '-' + Date.now().toString(36);
    const targetLabel = target.label || target.targetLabel || 'Booking Custom';

    const rule = {
      id,
      active: true,
      amount,
      percentage: 0,
      baseHours: customRuleForm.calculationMode === OPERATOR_FEE_CALCULATION_MODES.PER_BLOCK ? 1 : 1,
      overtimeAfterHours: 0,
      referencePrice: 0,
      targetType: target.targetType,
      targetId: target.targetId,
      targetLabel,
      matchMode: OPERATOR_FEE_MATCH_MODES.TARGET_ID,
      keyword: '',
      payeeRole: customRuleForm.payeeRole,
      calculationMode: customRuleForm.calculationMode,
      requireAssignedPerson: true,
      includeMeal: false,
      onlyForNoDurationPackage: target.targetType === OPERATOR_FEE_TARGET_TYPES.PACKAGE,
      bookkeepingCategory: 'crew',
      name: getCustomRuleTitle(target),
      titleTemplate: 'Fee Custom - {bookingCode} - {serviceLabel}',
      note: 'Fee custom untuk ' + targetLabel + '.',
    };

    setDraft((current) => normalizeOperatorFeeSettings({
      ...current,
      rules: [...current.rules, rule],
    }));

    setCustomRuleForm(emptyCustomRuleForm);
    setMessage('Rule baru ditambahkan. Rule ini langsung cocok dengan booking yang memakai ' + targetLabel + '.');
  }

  function deleteCustomRule(ruleId) {
    setDraft((current) => normalizeOperatorFeeSettings({
      ...current,
      rules: current.rules.filter((rule) => rule.id !== ruleId),
    }));

    if (message) setMessage('');
  }

  async function saveAllSettings() {
    try {
      const nextSettings = await saveOperatorFeeSettings(draft, {
        updatedByUid: currentUser?.uid || '',
      });

      setDraft(nextSettings);
      setMessage('Fee Settings berhasil disimpan.');
    } catch (error) {
      console.error('Gagal menyimpan fee settings:', error);
      setMessage('Fee Settings gagal disimpan. Pastikan akun owner dan Firestore rules sudah deploy.');
    }
  }

  async function resetDefaults() {
    const confirmed = window.confirm('Reset Fee Settings ke default awal?');
    if (!confirmed) return;

    try {
      const nextSettings = await saveOperatorFeeSettings(DEFAULT_OPERATOR_FEE_SETTINGS, {
        updatedByUid: currentUser?.uid || '',
      });

      setDraft(nextSettings);
      setPersonForm(emptyPersonForm);
      setCustomRuleForm(emptyCustomRuleForm);
      setMessage('Fee Settings dikembalikan ke default.');
    } catch (error) {
      console.error('Gagal reset fee settings:', error);
      setMessage('Reset Fee Settings gagal.');
    }
  }

  return (
    <section className="operator-fee-simple" aria-label="Fee settings operator">
      <section className="operator-fee-simple-hero">
        <span aria-hidden="true">
          <WalletCards size={22} />
        </span>
        <div>
          <p>Owner Only</p>
          <h3>Fee Settings</h3>
          <small>
            Atur nominal fee internal studio. Rule tambahan langsung terhubung ke booking dari Pricing Settings.
          </small>
        </div>
      </section>

      <section className="operator-fee-simple-summary" aria-label="Ringkasan fee settings">
        <article>
          <small>Crew Aktif</small>
          <strong>{activePeople.length}</strong>
          <span>{draft.people.length} total crew</span>
        </article>
        <article>
          <small>Fee Aktif</small>
          <strong>{activeSimpleRules.length}</strong>
          <span>{simpleFeeControls.length} nominal utama</span>
        </article>
        <article>
          <small>Rules Tambahan</small>
          <strong>{customRules.length}</strong>
          <span>custom booking fee</span>
        </article>
        <article>
          <small>Total Acuan</small>
          <strong>{formatOperatorFeeCurrency(estimatedMonthlyBase)}</strong>
          <span>nominal default</span>
        </article>
      </section>

      <section className="settings-section operator-fee-simple-card">
        <div className="settings-section-head">
          <div>
            <h3>Nominal Fee Utama</h3>
            <p>Angka harian yang paling sering dipakai.</p>
          </div>
        </div>

        <div className="operator-fee-simple-grid">
          {simpleFeeControls.map((control) => (
            <article className="operator-fee-simple-item" key={control.id}>
              <div className="operator-fee-simple-item-copy">
                <strong>{control.label}</strong>
                <small>{control.helper}</small>
              </div>

              <label className="operator-fee-money-input">
                <small>Nominal</small>
                <input
                  inputMode="numeric"
                  min="0"
                  type="number"
                  value={String(getRuleAmount(draft, control))}
                  onChange={(event) => updateSimpleAmount(control, event.target.value)}
                />
              </label>

              <label className="operator-fee-simple-switch">
                <input
                  checked={isRuleActive(draft, control)}
                  type="checkbox"
                  onChange={(event) => toggleSimpleRule(control, event.target.checked)}
                />
                <span>{isRuleActive(draft, control) ? 'Aktif' : 'Off'}</span>
              </label>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section operator-fee-simple-card is-add-rule">
        <div className="settings-section-head">
          <div>
            <h3>Tambah Rules</h3>
            <p>Pilih layanan/package dari Pricing Settings, isi nominal, selesai.</p>
          </div>
        </div>

        <form className="operator-fee-add-rule-form" onSubmit={addCustomRule}>
          <StudioSelect
            label="Untuk Booking"
            options={customTargetOptions}
            selectedKey={customRuleForm.targetKey}
            onChange={updateCustomRuleValue('targetKey')}
          />

          <StudioSelect
            label="Dibayar Ke"
            options={payeeOptions}
            selectedKey={customRuleForm.payeeRole}
            onChange={updateCustomRuleValue('payeeRole')}
          />

          <StudioSelect
            label="Hitung"
            options={simpleCalculationOptions}
            selectedKey={customRuleForm.calculationMode}
            onChange={updateCustomRuleValue('calculationMode')}
          />

          <StudioTextField
            id="operator-custom-rule-amount"
            inputMode="numeric"
            label="Nominal"
            min="0"
            placeholder="Contoh 50000"
            type="number"
            value={customRuleForm.amount}
            onChange={updateCustomRuleAmount}
          />

          <button className="settings-mini-button is-primary" type="submit">
            <Plus size={14} />
            Tambah Rule
          </button>
        </form>

        {customRules.length ? (
          <div className="operator-fee-custom-rule-list">
            {customRules.map((rule) => (
              <article key={rule.id}>
                <span>
                  <strong>{rule.name}</strong>
                  <small>{rule.targetLabel} · {rule.calculationMode} · {getRoleLabel(rule.payeeRole)}</small>
                </span>
                <em>{formatOperatorFeeCurrency(rule.amount)}</em>
                <button type="button" onClick={() => deleteCustomRule(rule.id)}>
                  <Trash2 size={13} />
                  Hapus
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="operator-fee-empty-note">Belum ada rules tambahan.</p>
        )}
      </section>

      <section className="settings-section operator-fee-simple-card">
        <div className="settings-section-head">
          <div>
            <h3>Crew Studio</h3>
            <p>Nama penjaga/operator yang dipilih di Operator Fee.</p>
          </div>
        </div>

        <form className="operator-fee-simple-crew-form" onSubmit={savePerson}>
          <StudioTextField
            id="simple-operator-person-name"
            label="Nama Crew"
            placeholder="Contoh: Bima"
            value={personForm.name}
            onChange={updatePersonField('name')}
          />

          <StudioSelect
            label="Tugas"
            options={roleOptions}
            selectedKey={personForm.role}
            onChange={updatePersonValue('role')}
          />

          <StudioSelect
            label="Bayar Via"
            options={paymentMethodOptions}
            selectedKey={personForm.defaultPaymentMethod}
            onChange={updatePersonValue('defaultPaymentMethod')}
          />

          <button className="settings-mini-button is-primary" type="submit">
            <Plus size={14} />
            Tambah Crew
          </button>
        </form>

        <div className="operator-fee-simple-crew-list">
          {draft.people.map((person) => (
            <article className={person.active ? 'operator-fee-simple-crew' : 'operator-fee-simple-crew is-muted'} key={person.id}>
              <span>
                <strong>{person.name}</strong>
                <small>{getRoleLabel(person.role)} · {person.defaultPaymentMethod}</small>
              </span>

              <button type="button" onClick={() => deletePerson(person.id)}>
                <Trash2 size={13} />
                Hapus
              </button>
            </article>
          ))}
        </div>
      </section>

      <details className="operator-fee-simple-advanced">
        <summary>
          <strong>Lihat rule teknis</strong>
          <small>Mapping otomatis. Biasanya tidak perlu dibuka.</small>
        </summary>

        <div>
          {draft.rules.map((rule) => (
            <article key={rule.id}>
              <span>
                <strong>{rule.name}</strong>
                <small>{rule.targetLabel} · {rule.calculationMode} · {rule.keyword || 'target tepat'}</small>
              </span>
              <em>{formatOperatorFeeCurrency(rule.amount)}</em>
            </article>
          ))}
        </div>
      </details>

      {message ? (
        <p className="operator-fee-simple-message" role="status">{message}</p>
      ) : null}

      <section className="operator-fee-simple-savebar" aria-label="Simpan fee settings">
        <button className="settings-mini-button is-ghost" type="button" onClick={resetDefaults}>
          <RefreshCcw size={14} />
          Reset Default
        </button>
        <button className="settings-mini-button is-primary" type="button" onClick={saveAllSettings}>
          <Save size={14} />
          Simpan Settings
        </button>
      </section>
    </section>
  );
}
