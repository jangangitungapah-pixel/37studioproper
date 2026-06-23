import { useEffect, useMemo, useState } from 'react';
import { Calculator, Pencil, Plus, RefreshCcw, Save, Trash2, UsersRound, WalletCards } from 'lucide-react';
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

const personRoleOptions = [
  { key: OPERATOR_FEE_PERSON_ROLES.GUARD, label: 'Penjaga Studio', description: 'Crew yang menjaga shift studio.' },
  { key: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR, label: 'Operator Recording', description: 'Operator recording track/live.' },
  { key: OPERATOR_FEE_PERSON_ROLES.BOTH, label: 'Bisa Keduanya', description: 'Bisa dipilih sebagai penjaga atau operator.' },
];

const payeeRoleOptions = [
  { key: OPERATOR_FEE_PERSON_ROLES.GUARD, label: 'Penjaga Studio', description: 'Fee masuk ke penjaga.' },
  { key: OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR, label: 'Operator Recording', description: 'Fee masuk ke operator.' },
];

const paymentMethodOptions = [
  { key: 'cash', label: 'Cash', description: 'Dibayar tunai.' },
  { key: 'transfer', label: 'Transfer', description: 'Transfer bank/e-wallet.' },
  { key: 'qris', label: 'QRIS', description: 'QRIS.' },
  { key: 'other', label: 'Lainnya', description: 'Metode lain.' },
];

const matchModeOptions = [
  { key: OPERATOR_FEE_MATCH_MODES.TARGET_ID, label: 'Target Tepat', description: 'Rule hanya berlaku untuk target yang dipilih.' },
  { key: OPERATOR_FEE_MATCH_MODES.KEYWORD, label: 'Keyword', description: 'Rule cocok berdasarkan kata kunci, misalnya track atau live.' },
  { key: OPERATOR_FEE_MATCH_MODES.ANY, label: 'Semua Target', description: 'Rule berlaku untuk semua target di tipe yang sama.' },
];

const calculationModeOptions = [
  { key: OPERATOR_FEE_CALCULATION_MODES.HOURLY, label: 'Per Jam', description: 'Durasi booking x amount.' },
  { key: OPERATOR_FEE_CALCULATION_MODES.DAILY, label: 'Per Hari', description: 'Sekali per hari aktif.' },
  { key: OPERATOR_FEE_CALCULATION_MODES.FLAT, label: 'Flat', description: 'Nominal tetap per booking.' },
  { key: OPERATOR_FEE_CALCULATION_MODES.PER_BLOCK, label: 'Per Block', description: 'Per kelipatan base hours.' },
  { key: OPERATOR_FEE_CALCULATION_MODES.OVERTIME_HOURLY, label: 'Overtime / Jam', description: 'Dihitung setelah batas overtime.' },
  { key: OPERATOR_FEE_CALCULATION_MODES.PERCENTAGE, label: 'Persentase', description: 'Persen dari total booking.' },
];

const emptyPersonForm = {
  id: '',
  name: '',
  role: OPERATOR_FEE_PERSON_ROLES.GUARD,
  defaultPaymentMethod: 'cash',
  note: '',
  active: true,
};

const emptyRuleForm = {
  id: '',
  name: '',
  targetKey: 'manual:general',
  targetType: OPERATOR_FEE_TARGET_TYPES.MANUAL,
  targetId: '',
  targetLabel: 'Manual',
  matchMode: OPERATOR_FEE_MATCH_MODES.TARGET_ID,
  keyword: '',
  payeeRole: OPERATOR_FEE_PERSON_ROLES.GUARD,
  calculationMode: OPERATOR_FEE_CALCULATION_MODES.FLAT,
  amount: '',
  percentage: '',
  baseHours: '1',
  overtimeAfterHours: '',
  referencePrice: '',
  requireAssignedPerson: true,
  includeMeal: false,
  onlyForNoDurationPackage: false,
  bookkeepingCategory: 'crew',
  titleTemplate: 'Operator Fee - {bookingCode} - {serviceLabel}',
  note: '',
  active: true,
};

function toNumberInput(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getRoleLabel(role) {
  return personRoleOptions.find((item) => item.key === role)?.label || role || '-';
}

function getCalculationLabel(mode) {
  return calculationModeOptions.find((item) => item.key === mode)?.label || mode || '-';
}

function getTargetKey(rule) {
  if (!rule?.targetType || rule.targetType === OPERATOR_FEE_TARGET_TYPES.MANUAL) {
    return 'manual:general';
  }

  if (rule.matchMode === OPERATOR_FEE_MATCH_MODES.KEYWORD) {
    return rule.targetType + ':keyword';
  }

  return rule.targetType + ':' + (rule.targetId || 'general');
}

function buildTargetOptions(pricingSettings) {
  return [
    { key: 'manual:general', label: 'Manual / General', description: 'Rule manual seperti uang makan.', targetType: OPERATOR_FEE_TARGET_TYPES.MANUAL, targetId: '', targetLabel: 'Manual' },
    { key: 'recordingType:keyword', label: 'Recording Type by Keyword', description: 'Cocokkan recording type dengan keyword seperti track/live.', targetType: OPERATOR_FEE_TARGET_TYPES.RECORDING_TYPE, targetId: '', targetLabel: 'Recording Type Keyword' },
    { key: 'package:keyword', label: 'Package by Keyword', description: 'Cocokkan package dengan keyword.', targetType: OPERATOR_FEE_TARGET_TYPES.PACKAGE, targetId: '', targetLabel: 'Package Keyword' },
    ...buildOperatorFeeTargetOptions(pricingSettings).map((item) => ({
      ...item,
      description: item.targetType + ' · ' + item.targetId,
      targetLabel: item.label,
    })),
  ];
}

export default function OperatorFeeSettingsPanel({ currentUser }) {
  const remoteOperatorFeeSettings = useOperatorFeeSettings();
  const pricingSettings = usePricingSettings();
  const [draft, setDraft] = useState(() => normalizeOperatorFeeSettings(remoteOperatorFeeSettings));
  const [personForm, setPersonForm] = useState(emptyPersonForm);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraft(normalizeOperatorFeeSettings(remoteOperatorFeeSettings));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [remoteOperatorFeeSettings]);

  const targetOptions = useMemo(() => buildTargetOptions(pricingSettings), [pricingSettings]);

  const activePeopleCount = draft.people.filter((person) => person.active).length;
  const activeRuleCount = draft.rules.filter((rule) => rule.active).length;
  const targetCount = targetOptions.length;

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

  function updatePersonBoolean(field) {
    return (event) => {
      const checked = event.target.checked;
      setPersonForm((current) => ({
        ...current,
        [field]: checked,
      }));
      if (message) setMessage('');
    };
  }

  function updateRuleField(field) {
    return (event) => {
      const value = event.target.value;
      setRuleForm((current) => ({
        ...current,
        [field]: value,
      }));
      if (message) setMessage('');
    };
  }

  function updateRuleValue(field) {
    return (nextValue) => {
      setRuleForm((current) => ({
        ...current,
        [field]: nextValue,
      }));
      if (message) setMessage('');
    };
  }

  function updateRuleBoolean(field) {
    return (event) => {
      const checked = event.target.checked;
      setRuleForm((current) => ({
        ...current,
        [field]: checked,
      }));
      if (message) setMessage('');
    };
  }

  function updateOptionNumber(field) {
    return (event) => {
      const value = event.target.value;
      setDraft((current) => normalizeOperatorFeeSettings({
        ...current,
        options: {
          ...current.options,
          [field]: toNumberInput(value),
        },
      }));
      if (message) setMessage('');
    };
  }

  function updateOptionBoolean(field) {
    return (event) => {
      const checked = event.target.checked;
      setDraft((current) => normalizeOperatorFeeSettings({
        ...current,
        options: {
          ...current.options,
          [field]: checked,
        },
      }));
      if (message) setMessage('');
    };
  }

  function handleTargetChange(nextKey) {
    const target = targetOptions.find((item) => item.key === nextKey) || targetOptions[0];
    const isKeywordTarget = nextKey.includes(':keyword');

    setRuleForm((current) => ({
      ...current,
      targetKey: nextKey,
      targetType: target.targetType,
      targetId: isKeywordTarget ? '' : target.targetId,
      targetLabel: target.targetLabel || target.label,
      matchMode: isKeywordTarget ? OPERATOR_FEE_MATCH_MODES.KEYWORD : OPERATOR_FEE_MATCH_MODES.TARGET_ID,
    }));

    if (message) setMessage('');
  }

  function savePerson(event) {
    event.preventDefault();

    const cleanName = personForm.name.trim();
    if (!cleanName) {
      setMessage('Nama crew tidak boleh kosong.');
      return;
    }

    const person = {
      ...personForm,
      id: personForm.id || makeOperatorFeeId('person'),
      name: cleanName,
      note: personForm.note.trim(),
    };

    setDraft((current) => {
      const exists = current.people.some((item) => item.id === person.id);

      return normalizeOperatorFeeSettings({
        ...current,
        people: exists
          ? current.people.map((item) => (item.id === person.id ? person : item))
          : [...current.people, person],
      });
    });

    setPersonForm(emptyPersonForm);
  }

  function editPerson(person) {
    setPersonForm({
      id: person.id,
      name: person.name,
      role: person.role,
      defaultPaymentMethod: person.defaultPaymentMethod,
      note: person.note,
      active: person.active,
    });
  }

  function deletePerson(id) {
    setDraft((current) => normalizeOperatorFeeSettings({
      ...current,
      people: current.people.filter((person) => person.id !== id),
    }));
  }

  function saveRule(event) {
    event.preventDefault();

    const cleanName = ruleForm.name.trim();
    if (!cleanName) {
      setMessage('Nama rule tidak boleh kosong.');
      return;
    }

    const rule = {
      ...ruleForm,
      id: ruleForm.id || makeOperatorFeeId('rule'),
      name: cleanName,
      amount: toNumberInput(ruleForm.amount),
      percentage: toNumberInput(ruleForm.percentage),
      baseHours: toNumberInput(ruleForm.baseHours),
      overtimeAfterHours: toNumberInput(ruleForm.overtimeAfterHours),
      referencePrice: toNumberInput(ruleForm.referencePrice),
      keyword: ruleForm.keyword.trim().toLowerCase(),
      note: ruleForm.note.trim(),
      titleTemplate: ruleForm.titleTemplate.trim() || 'Operator Fee - {bookingCode} - {serviceLabel}',
    };

    if (!rule.amount && !rule.percentage) {
      setMessage('Isi amount atau percentage untuk rule fee.');
      return;
    }

    setDraft((current) => {
      const exists = current.rules.some((item) => item.id === rule.id);

      return normalizeOperatorFeeSettings({
        ...current,
        rules: exists
          ? current.rules.map((item) => (item.id === rule.id ? rule : item))
          : [...current.rules, rule],
      });
    });

    setRuleForm(emptyRuleForm);
  }

  function editRule(rule) {
    setRuleForm({
      id: rule.id,
      name: rule.name,
      targetKey: getTargetKey(rule),
      targetType: rule.targetType,
      targetId: rule.targetId,
      targetLabel: rule.targetLabel,
      matchMode: rule.matchMode,
      keyword: rule.keyword,
      payeeRole: rule.payeeRole,
      calculationMode: rule.calculationMode,
      amount: String(rule.amount),
      percentage: String(rule.percentage),
      baseHours: String(rule.baseHours),
      overtimeAfterHours: rule.overtimeAfterHours ? String(rule.overtimeAfterHours) : '',
      referencePrice: rule.referencePrice ? String(rule.referencePrice) : '',
      requireAssignedPerson: rule.requireAssignedPerson,
      includeMeal: rule.includeMeal,
      onlyForNoDurationPackage: rule.onlyForNoDurationPackage,
      bookkeepingCategory: rule.bookkeepingCategory,
      titleTemplate: rule.titleTemplate,
      note: rule.note,
      active: rule.active,
    });
  }

  function deleteRule(id) {
    setDraft((current) => normalizeOperatorFeeSettings({
      ...current,
      rules: current.rules.filter((rule) => rule.id !== id),
    }));
  }

  async function saveAllSettings() {
    try {
      const saved = await saveOperatorFeeSettings(draft, {
        updatedByUid: currentUser?.uid || '',
      });

      setDraft(saved);
      setMessage('Fee Settings berhasil disimpan.');
    } catch (error) {
      console.error('Gagal menyimpan operator fee settings:', error);
      setMessage('Fee Settings gagal disimpan. Pastikan akun owner dan rules sudah deploy.');
    }
  }

  async function resetDefaults() {
    const confirmed = window.confirm('Reset Fee Settings ke default awal?');
    if (!confirmed) return;

    try {
      const saved = await saveOperatorFeeSettings(DEFAULT_OPERATOR_FEE_SETTINGS, {
        updatedByUid: currentUser?.uid || '',
      });

      setDraft(saved);
      setPersonForm(emptyPersonForm);
      setRuleForm(emptyRuleForm);
      setMessage('Fee Settings dikembalikan ke default.');
    } catch (error) {
      console.error('Gagal reset operator fee settings:', error);
      setMessage('Reset Fee Settings gagal.');
    }
  }

  return (
    <section className="operator-fee-settings" aria-label="Fee settings operator">
      <section className="settings-section operator-fee-settings-hero">
        <span className="operator-fee-settings-icon" aria-hidden="true">
          <WalletCards size={22} />
        </span>
        <div>
          <p>Owner Only</p>
          <h3>Fee Settings</h3>
          <span>
            Atur crew, rule fee, uang makan, dan mapping fee ke session, recording type, atau package yang sudah terdaftar di Pricing Settings.
          </span>
        </div>
      </section>

      <section className="operator-fee-settings-summary" aria-label="Ringkasan fee settings">
        <article>
          <small>Crew Aktif</small>
          <strong>{activePeopleCount}</strong>
          <span>{draft.people.length} total crew</span>
        </article>
        <article>
          <small>Rule Aktif</small>
          <strong>{activeRuleCount}</strong>
          <span>{draft.rules.length} total rule</span>
        </article>
        <article>
          <small>Uang Makan</small>
          <strong>{formatOperatorFeeCurrency(draft.options.mealPerPersonPerDay)}</strong>
          <span>per orang / hari</span>
        </article>
        <article>
          <small>Target Pricing</small>
          <strong>{targetCount}</strong>
          <span>session, recording, package</span>
        </article>
      </section>

      <section className="settings-section operator-fee-options-card">
        <div className="settings-section-head">
          <div>
            <h3>Default Options</h3>
            <p>Pengaturan umum untuk perhitungan fee dan posting ke pembukuan.</p>
          </div>
        </div>

        <div className="operator-fee-options-grid">
          <StudioTextField
            id="operator-fee-meal-default"
            inputMode="numeric"
            label="Uang Makan / Hari"
            min="0"
            placeholder="40000"
            type="number"
            value={String(draft.options.mealPerPersonPerDay)}
            onChange={updateOptionNumber('mealPerPersonPerDay')}
          />

          <label className="operator-fee-check">
            <input
              checked={draft.options.autoIncludeMeal}
              type="checkbox"
              onChange={updateOptionBoolean('autoIncludeMeal')}
            />
            <span>
              <strong>Auto include meal</strong>
              <small>Rule boleh menambahkan uang makan saat crew assigned.</small>
            </span>
          </label>

          <label className="operator-fee-check">
            <input
              checked={draft.options.duplicateProtection}
              type="checkbox"
              onChange={updateOptionBoolean('duplicateProtection')}
            />
            <span>
              <strong>Duplicate protection</strong>
              <small>Nanti mencegah posting pembukuan dobel untuk fee yang sama.</small>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section operator-fee-people-card">
        <div className="settings-section-head">
          <div>
            <h3>People / Payee</h3>
            <p>Daftar penjaga studio dan operator recording yang bisa dipilih di halaman Operator Fee.</p>
          </div>
        </div>

        <form className="operator-fee-form-grid" onSubmit={savePerson}>
          <StudioTextField
            id="operator-person-name"
            label="Nama Crew"
            placeholder="Contoh: Bima"
            value={personForm.name}
            onChange={updatePersonField('name')}
          />

          <StudioSelect
            label="Role"
            options={personRoleOptions}
            selectedKey={personForm.role}
            onChange={updatePersonValue('role')}
          />

          <StudioSelect
            label="Default Pembayaran"
            options={paymentMethodOptions}
            selectedKey={personForm.defaultPaymentMethod}
            onChange={updatePersonValue('defaultPaymentMethod')}
          />

          <StudioTextField
            id="operator-person-note"
            label="Catatan"
            placeholder="Opsional"
            value={personForm.note}
            onChange={updatePersonField('note')}
          />

          <label className="operator-fee-check">
            <input
              checked={personForm.active}
              type="checkbox"
              onChange={updatePersonBoolean('active')}
            />
            <span>
              <strong>Aktif</strong>
              <small>Crew bisa dipilih di Operator Fee.</small>
            </span>
          </label>

          <div className="operator-fee-form-actions">
            {personForm.id ? (
              <button className="settings-mini-button is-ghost" type="button" onClick={() => setPersonForm(emptyPersonForm)}>
                Batal Edit
              </button>
            ) : null}
            <button className="settings-mini-button is-primary" type="submit">
              <Plus size={14} />
              {personForm.id ? 'Update Crew' : 'Tambah Crew'}
            </button>
          </div>
        </form>

        <div className="operator-fee-list">
          {draft.people.map((person) => (
            <article className={person.active ? 'operator-fee-list-item' : 'operator-fee-list-item is-muted'} key={person.id}>
              <span>
                <strong>{person.name}</strong>
                <small>{getRoleLabel(person.role)} · {person.defaultPaymentMethod}</small>
              </span>
              <em>{person.active ? 'Aktif' : 'Nonaktif'}</em>
              <div>
                <button type="button" onClick={() => editPerson(person)}>
                  <Pencil size={13} />
                  Edit
                </button>
                <button type="button" onClick={() => deletePerson(person.id)}>
                  <Trash2 size={13} />
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section operator-fee-rules-card">
        <div className="settings-section-head">
          <div>
            <h3>Fee Rules</h3>
            <p>Mapping fee ke session, recording type, package, atau keyword. Rule ini nanti menjadi dasar estimasi di halaman Operator Fee.</p>
          </div>
        </div>

        <form className="operator-fee-rule-form" onSubmit={saveRule}>
          <StudioTextField
            id="operator-rule-name"
            label="Nama Rule"
            placeholder="Contoh: Fee Operator Recording Track"
            value={ruleForm.name}
            onChange={updateRuleField('name')}
          />

          <StudioSelect
            label="Target Pricing"
            options={targetOptions}
            selectedKey={ruleForm.targetKey}
            onChange={handleTargetChange}
          />

          <StudioSelect
            label="Match Mode"
            options={matchModeOptions}
            selectedKey={ruleForm.matchMode}
            onChange={updateRuleValue('matchMode')}
          />

          <StudioTextField
            id="operator-rule-keyword"
            label="Keyword"
            placeholder="track / live / mixing"
            value={ruleForm.keyword}
            onChange={updateRuleField('keyword')}
          />

          <StudioSelect
            label="Penerima Fee"
            options={payeeRoleOptions}
            selectedKey={ruleForm.payeeRole}
            onChange={updateRuleValue('payeeRole')}
          />

          <StudioSelect
            label="Mode Hitung"
            options={calculationModeOptions}
            selectedKey={ruleForm.calculationMode}
            onChange={updateRuleValue('calculationMode')}
          />

          <StudioTextField
            id="operator-rule-amount"
            inputMode="numeric"
            label="Amount"
            min="0"
            placeholder="Contoh 50000"
            type="number"
            value={ruleForm.amount}
            onChange={updateRuleField('amount')}
          />

          <StudioTextField
            id="operator-rule-percentage"
            inputMode="numeric"
            label="Percentage"
            min="0"
            placeholder="Opsional"
            type="number"
            value={ruleForm.percentage}
            onChange={updateRuleField('percentage')}
          />

          <StudioTextField
            id="operator-rule-base-hours"
            inputMode="numeric"
            label="Base Hours"
            min="0"
            placeholder="6"
            type="number"
            value={ruleForm.baseHours}
            onChange={updateRuleField('baseHours')}
          />

          <StudioTextField
            id="operator-rule-overtime"
            inputMode="numeric"
            label="Overtime After"
            min="0"
            placeholder="6"
            type="number"
            value={ruleForm.overtimeAfterHours}
            onChange={updateRuleField('overtimeAfterHours')}
          />

          <StudioTextField
            id="operator-rule-reference"
            inputMode="numeric"
            label="Reference Price"
            min="0"
            placeholder="950000"
            type="number"
            value={ruleForm.referencePrice}
            onChange={updateRuleField('referencePrice')}
          />

          <StudioTextField
            id="operator-rule-title"
            label="Judul Pembukuan"
            placeholder="Operator Fee - {bookingCode}"
            value={ruleForm.titleTemplate}
            onChange={updateRuleField('titleTemplate')}
          />

          <label className="operator-fee-check">
            <input
              checked={ruleForm.active}
              type="checkbox"
              onChange={updateRuleBoolean('active')}
            />
            <span>
              <strong>Rule aktif</strong>
              <small>Rule dipakai saat estimasi fee.</small>
            </span>
          </label>

          <label className="operator-fee-check">
            <input
              checked={ruleForm.requireAssignedPerson}
              type="checkbox"
              onChange={updateRuleBoolean('requireAssignedPerson')}
            />
            <span>
              <strong>Wajib assigned person</strong>
              <small>Fee baru final saat crew/operator sudah dipilih.</small>
            </span>
          </label>

          <label className="operator-fee-check">
            <input
              checked={ruleForm.includeMeal}
              type="checkbox"
              onChange={updateRuleBoolean('includeMeal')}
            />
            <span>
              <strong>Include meal</strong>
              <small>Rule boleh menambahkan uang makan.</small>
            </span>
          </label>

          <label className="operator-fee-check">
            <input
              checked={ruleForm.onlyForNoDurationPackage}
              type="checkbox"
              onChange={updateRuleBoolean('onlyForNoDurationPackage')}
            />
            <span>
              <strong>Khusus paket tanpa durasi</strong>
              <small>Cocok untuk mixing/mastering non-studio utama.</small>
            </span>
          </label>

          <div className="operator-fee-form-actions">
            {ruleForm.id ? (
              <button className="settings-mini-button is-ghost" type="button" onClick={() => setRuleForm(emptyRuleForm)}>
                Batal Edit
              </button>
            ) : null}
            <button className="settings-mini-button is-primary" type="submit">
              <Calculator size={14} />
              {ruleForm.id ? 'Update Rule' : 'Tambah Rule'}
            </button>
          </div>
        </form>

        <div className="operator-fee-rule-list">
          {draft.rules.map((rule) => (
            <article className={rule.active ? 'operator-fee-rule-item' : 'operator-fee-rule-item is-muted'} key={rule.id}>
              <div>
                <strong>{rule.name}</strong>
                <small>{rule.targetLabel} · {getCalculationLabel(rule.calculationMode)} · {getRoleLabel(rule.payeeRole)}</small>
                <span>{rule.note || rule.titleTemplate}</span>
              </div>
              <em>{rule.amount ? formatOperatorFeeCurrency(rule.amount) : rule.percentage + '%'}</em>
              <div>
                <button type="button" onClick={() => editRule(rule)}>
                  <Pencil size={13} />
                  Edit
                </button>
                <button type="button" onClick={() => deleteRule(rule.id)}>
                  <Trash2 size={13} />
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {message ? (
        <p className="operator-fee-message" role="status">{message}</p>
      ) : null}

      <section className="operator-fee-savebar" aria-label="Simpan fee settings">
        <button className="settings-mini-button is-ghost" type="button" onClick={resetDefaults}>
          <RefreshCcw size={14} />
          Reset Default
        </button>
        <button className="settings-mini-button is-primary" type="button" onClick={saveAllSettings}>
          <Save size={14} />
          Simpan Fee Settings
        </button>
      </section>
    </section>
  );
}
