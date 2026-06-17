export const INVOICE_SETTINGS_STORAGE_KEY = '37musicstudio.billing.invoice-settings.v1';

export const defaultInvoiceSettings = {
  studioName: '37 Music Studio',
  subtitle: 'Invoice Digital',
  phone: '',
  address: '',
  footer: 'Terima kasih sudah booking.',
  paperSize: '80mm',
  updatedAt: '',
};

export const paperSizeOptions = [
  { key: '80mm', label: 'Thermal 80mm', description: 'Ukuran struk umum' },
  { key: '58mm', label: 'Thermal 58mm', description: 'Ukuran struk kecil' },
];

export function normalizeInvoiceSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};

  return {
    ...defaultInvoiceSettings,
    ...source,
    studioName: String(source.studioName || defaultInvoiceSettings.studioName).trim() || defaultInvoiceSettings.studioName,
    subtitle: String(source.subtitle || defaultInvoiceSettings.subtitle).trim() || defaultInvoiceSettings.subtitle,
    phone: String(source.phone || '').trim(),
    address: String(source.address || '').trim(),
    footer: String(source.footer || defaultInvoiceSettings.footer).trim() || defaultInvoiceSettings.footer,
    paperSize: paperSizeOptions.some((item) => item.key === source.paperSize)
      ? source.paperSize
      : defaultInvoiceSettings.paperSize,
    updatedAt: source.updatedAt || '',
  };
}

export function readInvoiceSettings() {
  if (typeof window === 'undefined') return defaultInvoiceSettings;

  try {
    const raw = window.localStorage.getItem(INVOICE_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return normalizeInvoiceSettings(parsed);
  } catch (error) {
    console.error('Gagal membaca invoice settings:', error);
    return defaultInvoiceSettings;
  }
}

export function writeInvoiceSettings(settings) {
  if (typeof window === 'undefined') return defaultInvoiceSettings;

  const cleanSettings = normalizeInvoiceSettings(settings);
  window.localStorage.setItem(INVOICE_SETTINGS_STORAGE_KEY, JSON.stringify(cleanSettings));

  return cleanSettings;
}
