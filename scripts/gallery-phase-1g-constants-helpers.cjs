const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

const GALLERY_PAGE_FILE = 'src/pages/admin/GalleryPage.jsx';
const CONSTANTS_FILE = 'src/utils/galleryConstants.js';
const FILTERS_FILE = 'src/utils/galleryImageFilters.js';
const SYNTH_FILE = 'src/utils/lofiAmbientSynth.js';

const LOCAL_UTILS_START = '// Procedural Lo-fi Ambient Sound Generator using Web Audio API';
const PAGE_COMPONENT_START = 'export default function GalleryPage() {';

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

  fs.mkdirSync(path.dirname(target), { recursive: true });
  backup(file);
  fs.writeFileSync(target, normalized, 'utf8');
  console.log('✍️  Ditulis: ' + file);
  return true;
}

function replaceOnce(text, find, replacement, label) {
  if (!text.includes(find)) fail('Anchor tidak ditemukan: ' + label);
  return text.replace(find, replacement);
}

function replaceRange(text, startNeedle, endNeedle, replacement, label) {
  const start = text.indexOf(startNeedle);
  if (start === -1) fail('Start anchor tidak ditemukan: ' + label);

  const end = text.indexOf(endNeedle, start);
  if (end === -1) fail('End anchor tidak ditemukan: ' + label);

  return text.slice(0, start) + replacement.trimEnd() + text.slice(end);
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

function writeGalleryConstants() {
  const content = `export const CATEGORIES = [
  { value: 'Control Room', label: 'Ruang Kontrol', color: 'from-orange-500/20 to-amber-600/20' },
  { value: 'Recording Room', label: 'Ruang Rekaman', color: 'from-blue-500/20 to-indigo-600/20' },
  { value: 'Instruments', label: 'Instrumen / Alat', color: 'from-emerald-500/20 to-teal-600/20' },
  { value: 'Events', label: 'Kegiatan / Sesi', color: 'from-purple-500/20 to-pink-600/20' },
  { value: 'Others', label: 'Lain-lain', color: 'from-gray-500/20 to-slate-600/20' },
];

export const AUDIO_VISUALIZER_BAR_HEIGHTS = [7, 11, 5, 12, 8, 10];
`;

  writeIfChanged(CONSTANTS_FILE, content);
}

function writeGalleryFilters() {
  const content = `export function getFilteredActiveImages(rawImages = []) {
  return rawImages.filter((img) => !img.isDeleted);
}

export function getTrashedGalleryImages(rawImages = []) {
  return rawImages.filter((img) => img.isDeleted);
}

export function getDisplayedGalleryImages({
  activeTab,
  filteredActiveImages = [],
  searchQuery = '',
  selectedAlbum,
  selectedCategoryFilter,
  trashedImages = [],
}) {
  let list = [...filteredActiveImages];

  if (activeTab === 'albums' && selectedAlbum) {
    if (selectedAlbum === 'favorites') {
      list = list.filter((img) => img.isFavorite);
    } else if (selectedAlbum === 'recents') {
      list = list.slice(0, 8);
    } else {
      list = list.filter((img) => img.category === selectedAlbum);
    }
  } else if (activeTab === 'trash') {
    list = [...trashedImages];
  } else if (selectedCategoryFilter !== 'All') {
    list = list.filter((img) => img.category === selectedCategoryFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();

    list = list.filter((img) =>
      (img.title && img.title.toLowerCase().includes(q)) ||
      (img.description && img.description.toLowerCase().includes(q)) ||
      (img.category && img.category.toLowerCase().includes(q)) ||
      (img.uploadedBy && img.uploadedBy.toLowerCase().includes(q))
    );
  }

  return list;
}

export function getGalleryTimelineGroups(displayedImages = [], activeTab) {
  if (activeTab !== 'photos') return [];

  const groups = {};

  displayedImages.forEach((img) => {
    const date = new Date(img.createdAt);
    const monthYear = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }

    groups[monthYear].push(img);
  });

  return Object.keys(groups).map((monthYear) => ({
    title: monthYear,
    items: groups[monthYear],
  }));
}
`;

  writeIfChanged(FILTERS_FILE, content);
}

function writeLofiSynth() {
  const content = `export default class LofiAmbientSynth {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.nodes = [];
    this.chordTimer = null;
    this.droneOsc = null;
    this.noise = null;
    this.mainGain = null;
    this.filter = null;
  }

  start(volume = 0.5) {
    if (this.isPlaying) return;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.setValueAtTime(volume * 0.12, this.ctx.currentTime);
      this.mainGain.connect(this.ctx.destination);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.filter.connect(this.mainGain);

      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i += 1) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noise = this.ctx.createBufferSource();
      this.noise.buffer = noiseBuffer;
      this.noise.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

      this.noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.mainGain);
      this.noise.start();

      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'triangle';
      this.droneOsc.frequency.setValueAtTime(73.42, this.ctx.currentTime);

      const droneGain = this.ctx.createGain();
      droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

      this.droneOsc.connect(this.filter);
      this.droneOsc.connect(droneGain);
      droneGain.connect(this.mainGain);
      this.droneOsc.start();

      const scale = [146.83, 164.81, 220.00, 293.66, 329.63, 440.00, 587.33, 659.25];

      this.chordTimer = setInterval(() => {
        if (!this.ctx || this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        const count = Math.random() > 0.5 ? 2 : 1;

        for (let k = 0; k < count; k += 1) {
          const freq = scale[Math.floor(Math.random() * scale.length)];
          const osc = this.ctx.createOscillator();
          const oscGain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          oscGain.gain.setValueAtTime(0, now);
          oscGain.gain.linearRampToValueAtTime(0.06, now + 0.15);
          oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

          osc.connect(this.filter);
          osc.connect(oscGain);
          oscGain.connect(this.mainGain);

          osc.start(now);
          osc.stop(now + 3.6);
        }
      }, 3500);

      this.isPlaying = true;
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  setVolume(vol) {
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.setValueAtTime(vol * 0.12, this.ctx.currentTime);
    }
  }

  stop() {
    if (!this.isPlaying) return;

    clearInterval(this.chordTimer);

    if (this.noise) {
      try {
        this.noise.stop();
      } catch {
        // Audio nodes can already be stopped by the browser.
      }
    }

    if (this.droneOsc) {
      try {
        this.droneOsc.stop();
      } catch {
        // Audio nodes can already be stopped by the browser.
      }
    }

    if (this.ctx) {
      this.ctx.close();
    }

    this.isPlaying = false;
  }
}
`;

  writeIfChanged(SYNTH_FILE, content);
}

function patchGalleryPageImports(text) {
  if (!text.includes("import LofiAmbientSynth from '../../utils/lofiAmbientSynth.js';")) {
    text = replaceOnce(
      text,
      "import PhotoCard from '../../components/gallery/PhotoCard.jsx';",
      "import PhotoCard from '../../components/gallery/PhotoCard.jsx';\nimport { AUDIO_VISUALIZER_BAR_HEIGHTS, CATEGORIES } from '../../utils/galleryConstants.js';\nimport { getDisplayedGalleryImages, getFilteredActiveImages, getGalleryTimelineGroups, getTrashedGalleryImages } from '../../utils/galleryImageFilters.js';\nimport LofiAmbientSynth from '../../utils/lofiAmbientSynth.js';",
      'add gallery constants/filter/synth imports'
    );
  }

  return text;
}

function removeLocalConstantsAndSynth(text) {
  if (!text.includes(LOCAL_UTILS_START)) {
    console.log('↔️  Local synth/constants sudah tidak ada di GalleryPage.');
    return text;
  }

  return replaceRange(
    text,
    LOCAL_UTILS_START,
    PAGE_COMPONENT_START,
    PAGE_COMPONENT_START,
    'remove local synth and constants'
  );
}

function patchDerivedMemos(text) {
  const oldDerivedBlock = `  // Filter rawImages based on active tab and status
  const filteredActiveImages = useMemo(() => {
    return rawImages.filter(img => !img.isDeleted);
  }, [rawImages]);

  const trashedImages = useMemo(() => {
    return rawImages.filter(img => img.isDeleted);
  }, [rawImages]);

  // Derived filtered active photos (Search, Album selection, Category Filter)
  const displayedImages = useMemo(() => {
    let list = [...filteredActiveImages];

    // Filter by Album menu selection
    if (activeTab === 'albums' && selectedAlbum) {
      if (selectedAlbum === 'favorites') {
        list = list.filter(img => img.isFavorite);
      } else if (selectedAlbum === 'recents') {
        // limit to 8 most recent
        list = list.slice(0, 8);
      } else {
        // category folder
        list = list.filter(img => img.category === selectedAlbum);
      }
    } else if (activeTab === 'trash') {
      list = [...trashedImages];
    } else {
      // main "Photos" tab: Category Filter pills
      if (selectedCategoryFilter !== 'All') {
        list = list.filter(img => img.category === selectedCategoryFilter);
      }
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(img => 
        (img.title && img.title.toLowerCase().includes(q)) ||
        (img.description && img.description.toLowerCase().includes(q)) ||
        (img.category && img.category.toLowerCase().includes(q)) ||
        (img.uploadedBy && img.uploadedBy.toLowerCase().includes(q))
      );
    }

    return list;
  }, [filteredActiveImages, trashedImages, activeTab, selectedAlbum, selectedCategoryFilter, searchQuery]);

  // Group photos by Month-Year for the Photo timeline stream
  const timelineGroups = useMemo(() => {
    if (activeTab !== 'photos') return [];
    
    const groups = {};
    displayedImages.forEach(img => {
      const date = new Date(img.createdAt);
      const monthYear = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(img);
    });

    return Object.keys(groups).map(monthYear => ({
      title: monthYear,
      items: groups[monthYear]
    }));
  }, [displayedImages, activeTab]);
`;

  const newDerivedBlock = `  // Filter rawImages based on active tab and status
  const filteredActiveImages = useMemo(() => getFilteredActiveImages(rawImages), [rawImages]);

  const trashedImages = useMemo(() => getTrashedGalleryImages(rawImages), [rawImages]);

  // Derived filtered active photos (Search, Album selection, Category Filter)
  const displayedImages = useMemo(() => getDisplayedGalleryImages({
    activeTab,
    filteredActiveImages,
    searchQuery,
    selectedAlbum,
    selectedCategoryFilter,
    trashedImages,
  }), [filteredActiveImages, trashedImages, activeTab, selectedAlbum, selectedCategoryFilter, searchQuery]);

  // Group photos by Month-Year for the Photo timeline stream
  const timelineGroups = useMemo(
    () => getGalleryTimelineGroups(displayedImages, activeTab),
    [displayedImages, activeTab]
  );
`;

  if (!text.includes(oldDerivedBlock)) {
    if (text.includes('getDisplayedGalleryImages({')) {
      console.log('↔️  Derived memo block sudah memakai helper.');
      return text;
    }

    fail('Anchor derived memo block tidak ditemukan.');
  }

  return text.replace(oldDerivedBlock, newDerivedBlock);
}

function patchGalleryPage() {
  let text = read(GALLERY_PAGE_FILE);

  const requiredAnchors = [
    "import PhotoCard from '../../components/gallery/PhotoCard.jsx';",
    LOCAL_UTILS_START,
    'const CATEGORIES = [',
    'const AUDIO_VISUALIZER_BAR_HEIGHTS = [7, 11, 5, 12, 8, 10];',
    'rawImages.filter(img => !img.isDeleted)',
    'rawImages.filter(img => img.isDeleted)',
    'const displayedImages = useMemo(() => {',
    'const timelineGroups = useMemo(() => {',
    'new LofiAmbientSynth()',
  ];

  for (const anchor of requiredAnchors) {
    if (!text.includes(anchor)) {
      if (
        text.includes("import LofiAmbientSynth from '../../utils/lofiAmbientSynth.js';") &&
        text.includes('getDisplayedGalleryImages({')
      ) {
        console.log('↔️  GalleryPage terlihat sudah pernah dipatch 1G.');
        break;
      }

      fail('Anchor GalleryPage tidak ditemukan: ' + anchor);
    }
  }

  text = patchGalleryPageImports(text);
  text = removeLocalConstantsAndSynth(text);
  text = patchDerivedMemos(text);

  assertNoTopLevelOrphan(text, GALLERY_PAGE_FILE);
  writeIfChanged(GALLERY_PAGE_FILE, text);

  const result = read(GALLERY_PAGE_FILE);

  const required = [
    "import { AUDIO_VISUALIZER_BAR_HEIGHTS, CATEGORIES } from '../../utils/galleryConstants.js';",
    "import { getDisplayedGalleryImages, getFilteredActiveImages, getGalleryTimelineGroups, getTrashedGalleryImages } from '../../utils/galleryImageFilters.js';",
    "import LofiAmbientSynth from '../../utils/lofiAmbientSynth.js';",
    'getFilteredActiveImages(rawImages)',
    'getTrashedGalleryImages(rawImages)',
    'getDisplayedGalleryImages({',
    'getGalleryTimelineGroups(displayedImages, activeTab)',
    'new LofiAmbientSynth()',
  ];

  for (const needle of required) {
    if (!result.includes(needle)) fail('Verifikasi GalleryPage gagal: ' + needle);
  }

  const forbidden = [
    LOCAL_UTILS_START,
    'class LofiAmbientSynth',
    'const CATEGORIES = [',
    'const AUDIO_VISUALIZER_BAR_HEIGHTS = [7, 11, 5, 12, 8, 10];',
    'rawImages.filter(img => !img.isDeleted)',
    'rawImages.filter(img => img.isDeleted)',
    'const groups = {};',
  ];

  for (const needle of forbidden) {
    if (result.includes(needle)) fail('Local utility masih tersisa di GalleryPage: ' + needle);
  }
}

function verifyCreatedFiles() {
  const checks = [
    [CONSTANTS_FILE, ['export const CATEGORIES', 'export const AUDIO_VISUALIZER_BAR_HEIGHTS']],
    [FILTERS_FILE, ['export function getFilteredActiveImages', 'export function getDisplayedGalleryImages', 'export function getGalleryTimelineGroups']],
    [SYNTH_FILE, ['export default class LofiAmbientSynth', 'start(volume = 0.5)', 'setVolume(vol)', 'stop()']],
  ];

  for (const [file, needles] of checks) {
    const content = read(file);

    for (const needle of needles) {
      if (!content.includes(needle)) fail('Verifikasi gagal di ' + file + ': ' + needle);
    }
  }
}

function main() {
  writeGalleryConstants();
  writeGalleryFilters();
  writeLofiSynth();
  patchGalleryPage();
  verifyCreatedFiles();

  console.log('\n✅ PHASE GALLERY 1G selesai.');
  console.log('🧩 Constants, filter helpers, dan LofiAmbientSynth sudah diextract.');
  console.log('🎛️ GalleryPage makin fokus ke state orchestration.');
  console.log('🎧 Behavior audio/slideshow tetap dipertahankan.');
}

main();