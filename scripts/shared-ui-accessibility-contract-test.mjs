import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const selectSource = await readFile(new URL('../src/components/ui/StudioSelect.jsx', import.meta.url), 'utf8');
const textFieldSource = await readFile(new URL('../src/components/ui/StudioTextField.jsx', import.meta.url), 'utf8');
const confirmSource = await readFile(new URL('../src/components/ui/ConfirmDialog.jsx', import.meta.url), 'utf8');

for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) {
  assert.match(selectSource, new RegExp(`['"]${key}['"]`), `StudioSelect must handle ${key}`);
}

assert.match(selectSource, /role="combobox"/);
assert.match(selectSource, /role="listbox"/);
assert.match(selectSource, /role="option"/);
assert.match(selectSource, /aria-activedescendant=/);
assert.match(selectSource, /aria-selected=/);
assert.match(selectSource, /handleTypeahead/);
assert.match(selectSource, /startsWith\(query\)/);

assert.match(textFieldSource, /const generatedId = useId\(\)/);
assert.match(textFieldSource, /const describedBy = \[helper \? helperId : null, error \? errorId : null\]/);
assert.match(textFieldSource, /aria-describedby=\{describedBy\}/);
assert.match(textFieldSource, /aria-errormessage=\{error \? errorId : undefined\}/);
assert.match(textFieldSource, /aria-invalid=\{error \? true : undefined\}/);

assert.match(confirmSource, /cancelButtonRef\.current\?\.focus\(\)/);
assert.match(confirmSource, /FOCUSABLE_SELECTOR/);
assert.match(confirmSource, /previousFocus\?\.isConnected/);
assert.match(confirmSource, /await onConfirm\?\.\(\)/);
assert.match(confirmSource, /isLoading=\{isPending\}/);
assert.match(confirmSource, /role="alert"/);
assert.match(confirmSource, /startedOnBackdrop && event\.target === event\.currentTarget/);

console.log('shared-ui-accessibility-contract-test: ok');
