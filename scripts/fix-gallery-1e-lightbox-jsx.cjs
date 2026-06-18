const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

const GALLERY_PAGE_FILE = 'src/pages/admin/GalleryPage.jsx';
const LIGHTBOX_FILE = 'src/components/gallery/GalleryLightbox.jsx';

const LIGHTBOX_START = '      {/* 7. CINEMATIC FULLSCREEN LIGHTBOX & MEDIA CENTER */}';
const PAGE_END = '\n    </section>\n  );\n}';

const PAGE_PROPS = [
  ['activePhoto', 'activePhoto'],
  ['activePhotoIndex', 'activePhotoIndex'],
  ['audioVisualizerBarHeights', 'AUDIO_VISUALIZER_BAR_HEIGHTS'],
  ['audioVolume', 'audioVolume'],
  ['Calendar', 'Calendar'],
  ['Camera', 'Camera'],
  ['canvasRef', 'canvasRef'],
  ['categories', 'CATEGORIES'],
  ['ChevronLeft', 'ChevronLeft'],
  ['ChevronRight', 'ChevronRight'],
  ['closeLightbox', 'closeLightbox'],
  ['Crop', 'Crop'],
  ['displayedImages', 'displayedImages'],
  ['Download', 'Download'],
  ['editorAdjustments', 'editorAdjustments'],
  ['editorCropPreset', 'editorCropPreset'],
  ['editorFilterPreset', 'editorFilterPreset'],
  ['editorFlip', 'editorFlip'],
  ['editorWatermark', 'editorWatermark'],
  ['exifDetails', 'exifDetails'],
  ['handleDownloadEditedImage', 'handleDownloadEditedImage'],
  ['handleNextPhoto', 'handleNextPhoto'],
  ['handlePermanentDelete', 'handlePermanentDelete'],
  ['handlePrevPhoto', 'handlePrevPhoto'],
  ['handleRestore', 'handleRestore'],
  ['handleSaveEditedImage', 'handleSaveEditedImage'],
  ['handleSoftDelete', 'handleSoftDelete'],
  ['handleToggleFavorite', 'handleToggleFavorite'],
  ['handleVolumeChange', 'handleVolumeChange'],
  ['Heart', 'Heart'],
  ['imgElement', 'imgElement'],
  ['Info', 'Info'],
  ['isEditing', 'isEditing'],
  ['isInfoPanelOpen', 'isInfoPanelOpen'],
  ['isMusicPlaying', 'isMusicPlaying'],
  ['isSavingEdit', 'isSavingEdit'],
  ['isSlideshowPlaying', 'isSlideshowPlaying'],
  ['LoaderCircle', 'LoaderCircle'],
  ['MapPin', 'MapPin'],
  ['Music', 'Music'],
  ['Pause', 'Pause'],
  ['Play', 'Play'],
  ['Plus', 'Plus'],
  ['RefreshCw', 'RefreshCw'],
  ['RotateCw', 'RotateCw'],
  ['setEditorAdjustments', 'setEditorAdjustments'],
  ['setEditorCropPreset', 'setEditorCropPreset'],
  ['setEditorFilterPreset', 'setEditorFilterPreset'],
  ['setEditorFlip', 'setEditorFlip'],
  ['setEditorRotation', 'setEditorRotation'],
  ['setEditorWatermark', 'setEditorWatermark'],
  ['setIsEditing', 'setIsEditing'],
  ['setIsInfoPanelOpen', 'setIsInfoPanelOpen'],
  ['setIsMusicPlaying', 'setIsMusicPlaying'],
  ['setIsSlideshowPlaying', 'setIsSlideshowPlaying'],
  ['Trash', 'Trash'],
  ['Trash2', 'Trash2'],
  ['Type', 'Type'],
  ['User', 'User'],
  ['Volume2', 'Volume2'],
  ['VolumeX', 'VolumeX'],
  ['X', 'X'],
];

function fail(message) {
  console.error('\n❌ ' + message);
  process.exit(1);
}

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) fail('File tidak ditemukan: ' + file);
  return fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
}

function backup(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) return;
  fs.copyFileSync(target, target + '.bak-' + STAMP);
}

function writeIfChanged(file, content) {
  const target = abs(file);
  const normalized = content.replace(/\r\n/g, '\n').trimEnd() + '\n';
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';

  if (current === normalized) {
    console.log('↔️  Tidak berubah: ' + file);
    return false;
  }

  backup(file);
  fs.writeFileSync(target, normalized, 'utf8');
  console.log('✍️  Ditulis: ' + file);
  return true;
}

function replaceOnce(text, find, replacement, label) {
  if (!text.includes(find)) fail('Anchor tidak ditemukan: ' + label);
  return text.replace(find, replacement);
}

function assertNoTopLevelOrphan(text, file) {
  if (/^\s*\) \{$/m.test(text)) {
    const badLines = text
      .split('\n')
      .map((line, index) => (line.trim() === ') {' ? index + 1 : null))
      .filter(Boolean);

    fail(file + ' masih punya orphan top-level ") {" di line: ' + badLines.join(', '));
  }
}

function showContext(text, targetLine) {
  const lines = text.split('\n');
  const start = Math.max(1, targetLine - 5);
  const end = Math.min(lines.length, targetLine + 5);

  console.log('\n🔎 Context sekitar GalleryPage line ' + targetLine + ':');
  for (let lineNo = start; lineNo <= end; lineNo += 1) {
    const marker = lineNo === targetLine ? '>>' : '  ';
    console.log(marker + ' ' + String(lineNo).padStart(4, ' ') + ': ' + lines[lineNo - 1]);
  }
}

function buildLightboxInvocation() {
  const propLines = PAGE_PROPS
    .map(([propName, valueName]) => `        ${propName}={${valueName}}`)
    .join('\n');

  return `${LIGHTBOX_START}
      <GalleryLightbox
${propLines}
      />
`;
}

function patchGalleryPage() {
  let text = read(GALLERY_PAGE_FILE);
  showContext(text, 1041);

  if (!text.includes("import GalleryLightbox from '../../components/gallery/GalleryLightbox.jsx';")) {
    text = replaceOnce(
      text,
      "import GalleryUploadModal from '../../components/gallery/GalleryUploadModal.jsx';",
      "import GalleryUploadModal from '../../components/gallery/GalleryUploadModal.jsx';\nimport GalleryLightbox from '../../components/gallery/GalleryLightbox.jsx';",
      'add GalleryLightbox import'
    );
  }

  const start = text.indexOf(LIGHTBOX_START);
  if (start === -1) fail('Start anchor lightbox tidak ditemukan di GalleryPage.');

  const end = text.indexOf(PAGE_END, start);
  if (end === -1) fail('End anchor page tidak ditemukan setelah lightbox invocation.');

  text = text.slice(0, start) + buildLightboxInvocation().trimEnd() + text.slice(end);

  assertNoTopLevelOrphan(text, GALLERY_PAGE_FILE);
  writeIfChanged(GALLERY_PAGE_FILE, text);

  const result = read(GALLERY_PAGE_FILE);

  const required = [
    '<GalleryLightbox',
    'audioVisualizerBarHeights={AUDIO_VISUALIZER_BAR_HEIGHTS}',
    'categories={CATEGORIES}',
    'handleSaveEditedImage={handleSaveEditedImage}',
    'canvasRef={canvasRef}',
  ];

  for (const needle of required) {
    if (!result.includes(needle)) fail('Verifikasi GalleryPage gagal: ' + needle);
  }

  const forbidden = [
    'AUDIO_VISUALIZER_BAR_HEIGHTS={AUDIO_VISUALIZER_BAR_HEIGHTS}',
    'CATEGORIES={CATEGORIES}',
    'PHOTO STUDIO EDITOR VIEW',
    'Informasi Detail Media',
    'Ambient Lofi Playing',
  ];

  for (const needle of forbidden) {
    if (result.includes(needle)) fail('Inline/bad GalleryPage fragment masih tersisa: ' + needle);
  }
}

function patchGalleryLightbox() {
  let text = read(LIGHTBOX_FILE);

  const required = [
    'export default function GalleryLightbox({',
    'PHOTO STUDIO EDITOR VIEW',
    'Slideshow audio visualizer footer',
  ];

  for (const anchor of required) {
    if (!text.includes(anchor)) fail('Anchor GalleryLightbox tidak ditemukan: ' + anchor);
  }

  text = text.replace(
    /^\s*AUDIO_VISUALIZER_BAR_HEIGHTS,\n/m,
    '  audioVisualizerBarHeights,\n'
  );

  text = text.replace(
    /^\s*CATEGORIES,\n/m,
    '  categories,\n'
  );

  if (!text.includes('const CATEGORIES = categories;')) {
    text = replaceOnce(
      text,
      `}) {
  return (`,
      `}) {
  const CATEGORIES = categories;
  const AUDIO_VISUALIZER_BAR_HEIGHTS = audioVisualizerBarHeights;

  return (`,
      'add aliases for extracted lightbox constants'
    );
  }

  assertNoTopLevelOrphan(text, LIGHTBOX_FILE);
  writeIfChanged(LIGHTBOX_FILE, text);

  const result = read(LIGHTBOX_FILE);

  const checks = [
    'audioVisualizerBarHeights,',
    'categories,',
    'const CATEGORIES = categories;',
    'const AUDIO_VISUALIZER_BAR_HEIGHTS = audioVisualizerBarHeights;',
    'AUDIO_VISUALIZER_BAR_HEIGHTS.map',
    'CATEGORIES.find',
  ];

  for (const needle of checks) {
    if (!result.includes(needle)) fail('Verifikasi GalleryLightbox gagal: ' + needle);
  }
}

function main() {
  patchGalleryPage();
  patchGalleryLightbox();

  console.log('\n✅ HOTFIX PHASE GALLERY 1E selesai.');
  console.log('🧩 JSX props GalleryLightbox sudah dirapihin.');
  console.log('🎬 Lightbox tetap di component terpisah.');
  console.log('🧪 Lanjut lint/test/build.');
}

main();