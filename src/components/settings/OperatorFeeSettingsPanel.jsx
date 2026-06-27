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
  const visibleRules = draft.rules.filter((rule) => rule.id !== 'guard-daily-meal');
  const activeRules = visibleRules.filter((rule) => rule.active !== false);

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
      const nextSettings = await saveOperatorFeeSettings({
        ...draft,
        rules: draft.rules.filter((rule) => rule.id !== 'guard-daily-meal'),
      }, {
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

      {/* ── HEADER STRIP ───────────────────────────────── */}
      <section className="operator-fee-simple-hero-strip">
        <span aria-hidden="true" className="fee-hero-icon">
          <WalletCards size={18} />
        </span>
        <div className="fee-hero-info">
          <p>Owner Only</p>
          <h3>Fee Settings</h3>
        </div>
      </section>

      {/* ── STATS SUMMARY GRID ─────────────────────────── */}
      <section className="operator-fee-simple-summary-strip" aria-label="Ringkasan fee settings">
        <div className="fee-summary-box">
          <small>Crew Aktif</small>
          <strong>{activePeople.length}</strong>
          <span>{draft.people.length} total crew</span>
        </div>
        <div className="fee-summary-box">
          <small>Rules Aktif</small>
          <strong>{activeRules.length}</strong>
          <span>{draft.rules.length} total rules</span>
        </div>
      </section>

      {/* ── TAMBAH RULES CUSTOM ────────────────────────── */}
      <section className="settings-section">
        <h3 className="settings-section-title">Rules Fee Studio</h3>

        <form className="settings-account-form-compact" onSubmit={addCustomRule}>
          <div className="settings-studio-grid">
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
          </div>

          <div className="settings-studio-grid">
            <StudioSelect
              label="Hitung"
              options={simpleCalculationOptions}
              selectedKey={customRuleForm.calculationMode}
              onChange={updateCustomRuleValue('calculationMode')}
            />

            <StudioTextField
              id="operator-custom-rule-amount"
              className="is-currency"
              inputMode="numeric"
              label="Nominal"
              min="0"
              placeholder="50000"
              type="number"
              value={customRuleForm.amount}
              onChange={updateCustomRuleAmount}
            />
          </div>

          <div className="fee-form-actions">
            <button className="settings-mini-button is-primary" type="submit">
              <Plus size={14} />
              Tambah Rule
            </button>
          </div>
        </form>

        {visibleRules.length ? (
          <div className="fee-flat-rules-list settings-section-divider">
            {visibleRules.map((rule) => (
              <div className="fee-rule-inline-row" key={rule.id}>
                <div className="fee-rule-info">
                  <strong className="fee-rule-title">{rule.name}</strong>
                  <small className="fee-rule-subtitle">{rule.targetLabel} · {rule.calculationMode} · {getRoleLabel(rule.payeeRole)}</small>
                </div>
                <div className="fee-rule-inputs-wrap">
                  <strong className="fee-rule-amount-badge">{formatOperatorFeeCurrency(rule.amount)}</strong>
                  <button type="button" className="settings-icon-action-btn is-delete" aria-label="Delete rule" onClick={() => deleteCustomRule(rule.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="operator-fee-empty-note">Belum ada rules tambahan.</p>
        )}
      </section>

      {/* ── UANG MAKAN & ABSEN ────────────────────────── */}
      <section className="settings-section">
        <h3 className="settings-section-title">Uang Makan &amp; Absen</h3>
        <div className="settings-account-form-compact">
          <StudioTextField
            id="fee-setting-meal-amount"
            className="is-currency"
            inputMode="numeric"
            label="Uang Makan Penjaga (Per Hari)"
            min="0"
            placeholder="40000"
            type="number"
            value={draft.options?.mealPerPersonPerDay !== undefined ? draft.options.mealPerPersonPerDay : 40000}
            onChange={(event) => {
              const amount = toNumberInput(event.target.value);
              setDraft((current) => ({
                ...current,
                options: {
                  ...current.options,
                  mealPerPersonPerDay: amount,
                },
              }));
              if (message) setMessage('');
            }}
          />
        </div>
      </section>

      {/* ── CREW STUDIO ────────────────────────────────── */}
      <section className="settings-section">
        <h3 className="settings-section-title">Crew Studio</h3>

        <form className="settings-account-form-compact" onSubmit={savePerson}>
          <div className="settings-studio-grid">
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
          </div>

          <div className="settings-studio-grid">
            <StudioSelect
              label="Bayar Via"
              options={paymentMethodOptions}
              selectedKey={personForm.defaultPaymentMethod}
              onChange={updatePersonValue('defaultPaymentMethod')}
            />
            <div className="fee-form-actions">
              <button className="settings-mini-button is-primary" type="submit">
                <Plus size={14} />
                Tambah Crew
              </button>
            </div>
          </div>
        </form>

        {draft.people.length ? (
          <div className="fee-flat-rules-list settings-section-divider">
            {draft.people.map((person) => (
              <div className={person.active ? 'fee-rule-inline-row' : 'fee-rule-inline-row is-muted'} key={person.id}>
                <div className="fee-rule-info">
                  <strong className="fee-rule-title">{person.name}</strong>
                  <small className="fee-rule-subtitle">{getRoleLabel(person.role)} · {person.defaultPaymentMethod}</small>
                </div>
                <div className="fee-rule-inputs-wrap">
                  <button type="button" className="settings-icon-action-btn is-delete" aria-label="Delete crew" onClick={() => deletePerson(person.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {message ? (
        <p className="settings-invoice-message" role="status">{message}</p>
      ) : null}

      {/* ── STICKY SAVEBAR ─────────────────────────────── */}
      <div className="settings-invoice-actions-sticky">
        <button className="settings-mini-button is-ghost" type="button" onClick={resetDefaults}>
          <RefreshCcw size={14} />
          Reset Default
        </button>
        <button className="settings-mini-button is-primary" type="button" onClick={saveAllSettings}>
          <Save size={14} />
          Simpan Settings
        </button>
      </div>

    </section>
  );
}
