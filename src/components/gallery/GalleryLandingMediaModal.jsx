import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Globe,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  LANDING_HERO_DEFAULT_URL,
  LANDING_MEDIA_FOCUS_PRESETS,
  LANDING_MEDIA_SPOT_DEFAULTS,
  getPhotoLandingAssignments,
  normalizeLandingMedia,
} from '../../settings/studioSettings.js';

function getSlotMeta(slotKey) {
  if (slotKey === 'hero') {
    return {
      slotKey: 'hero',
      label: 'Foto Utama Hero',
      description: 'Tampil besar pada banner utama di bagian atas landing page.',
    };
  }
  if (slotKey === 'extra') {
    return {
      slotKey: 'extra',
      label: 'Dokumentasi Pilihan',
      description: 'Ditampilkan pada strip galeri dokumentasi di bawah Pratinjau Ruang.',
    };
  }
  const found = LANDING_MEDIA_SPOT_DEFAULTS.find((item) => item.slotKey === slotKey);
  return {
    slotKey: found?.slotKey || 'spot1',
    label: found?.slotLabel || 'Pratinjau Ruang',
    description: found?.slotDescription || 'Kartu pratinjau ruang studio di landing page.',
    defaultBadge: found?.badge || '',
    defaultTitle: found?.title || '',
    defaultCaption: found?.caption || '',
  };
}

function buildInitialModalState({
  activeImages,
  landingMedia,
  mode,
  photo,
  targetSlot,
}) {
  const normalized = normalizeLandingMedia(landingMedia);

  if (mode === 'photo' && photo) {
    const assignments = getPhotoLandingAssignments(photo, { landingMedia: normalized });
    const firstAssignedSpot = assignments.spots[0] || 'spot1';
    const initialSpotDrafts = {};

    LANDING_MEDIA_SPOT_DEFAULTS.forEach((slotDefault) => {
      const existing = normalized.spots.find((s) => s.slotKey === slotDefault.slotKey) || {};
      const belongsToThisPhoto = existing.galleryId === photo.id || (existing.url && existing.url === photo.url);

      initialSpotDrafts[slotDefault.slotKey] = {
        badge: belongsToThisPhoto ? (existing.badge || slotDefault.badge) : slotDefault.badge,
        title: belongsToThisPhoto ? (existing.title || photo.title || slotDefault.title) : (photo.title || slotDefault.title),
        caption: belongsToThisPhoto ? (existing.caption || photo.description || slotDefault.caption) : (photo.description || slotDefault.caption),
      };
    });

    const heroMatch = normalized.hero.galleryId === photo.id || (normalized.hero.url && normalized.hero.url === photo.url);
    const matchedSpotObj = normalized.spots.find(
      (s) => s.galleryId === photo.id || (s.url && s.url === photo.url),
    );
    const matchedExtraObj = normalized.galleryExtras.find(
      (e) => e.galleryId === photo.id || (e.url && e.url === photo.url),
    );

    const initialFocus =
      (heroMatch && normalized.hero.objectPosition) ||
      matchedSpotObj?.objectPosition ||
      matchedExtraObj?.objectPosition ||
      '50% 50%';

    return {
      selectedPhotoId: photo.id || '',
      heroSelected: assignments.hero,
      selectedSpots: [...assignments.spots],
      extraSelected: assignments.isExtra,
      activeTextTab: firstAssignedSpot,
      heroAlt: heroMatch
        ? (normalized.hero.alt || photo.title || '')
        : (photo.title || ''),
      spotDrafts: initialSpotDrafts,
      extraTitle: matchedExtraObj?.title || photo.title || '',
      extraCaption: matchedExtraObj?.caption || photo.description || '',
      objectPosition: initialFocus,
    };
  }

  // mode === 'slot'
  const slotKey = targetSlot || 'hero';
  let currentUrl = '';
  let currentGalleryId = '';
  let currentAlt = '';
  let currentFocus = '50% 50%';
  let currentBadge = '';
  let currentTitle = '';
  let currentCaption = '';

  if (slotKey === 'hero') {
    currentUrl = normalized.hero.url;
    currentGalleryId = normalized.hero.galleryId;
    currentAlt = normalized.hero.alt;
    currentFocus = normalized.hero.objectPosition || '50% 48%';
  } else if (slotKey !== 'extra') {
    const slotDefault = LANDING_MEDIA_SPOT_DEFAULTS.find((s) => s.slotKey === slotKey);
    const existing = normalized.spots.find((s) => s.slotKey === slotKey) || {};
    currentUrl = existing.url;
    currentGalleryId = existing.galleryId;
    currentFocus = existing.objectPosition || '50% 50%';
    currentBadge = existing.badge || slotDefault?.badge || '';
    currentTitle = existing.title || slotDefault?.title || '';
    currentCaption = existing.caption || slotDefault?.caption || '';
  }

  const matchedPhoto =
    activeImages.find((img) => img.id && img.id === currentGalleryId) ||
    activeImages.find((img) => img.url && img.url === currentUrl) ||
    null;

  return {
    selectedPhotoId: matchedPhoto?.id || '',
    heroSelected: slotKey === 'hero',
    selectedSpots: slotKey.startsWith('spot') ? [slotKey] : [],
    extraSelected: slotKey === 'extra',
    activeTextTab: slotKey.startsWith('spot') ? slotKey : 'spot1',
    heroAlt: currentAlt || matchedPhoto?.title || '',
    spotDrafts: LANDING_MEDIA_SPOT_DEFAULTS.reduce((acc, def) => {
      acc[def.slotKey] = {
        badge: def.slotKey === slotKey ? currentBadge : def.badge,
        title: def.slotKey === slotKey ? currentTitle : def.title,
        caption: def.slotKey === slotKey ? currentCaption : def.caption,
      };
      return acc;
    }, {}),
    extraTitle: '',
    extraCaption: '',
    objectPosition: currentFocus,
  };
}

export default function GalleryLandingMediaModal({
  activeImages = [],
  categories = [],
  isSaving = false,
  landingMedia,
  mode = 'photo',
  onClose,
  onOpenUpload,
  onResetSlot,
  onSave,
  photo = null,
  targetSlot = 'hero',
}) {
  const initialState = buildInitialModalState({
    activeImages,
    landingMedia,
    mode,
    photo,
    targetSlot,
  });

  const [selectedPhotoId, setSelectedPhotoId] = useState(initialState.selectedPhotoId);
  const [heroSelected, setHeroSelected] = useState(initialState.heroSelected);
  const [selectedSpots, setSelectedSpots] = useState(initialState.selectedSpots);
  const [extraSelected, setExtraSelected] = useState(initialState.extraSelected);
  const [activeTextTab, setActiveTextTab] = useState(initialState.activeTextTab);
  const [heroAlt, setHeroAlt] = useState(initialState.heroAlt);
  const [spotDrafts, setSpotDrafts] = useState(initialState.spotDrafts);
  const [extraTitle, setExtraTitle] = useState(initialState.extraTitle);
  const [extraCaption, setExtraCaption] = useState(initialState.extraCaption);
  const [objectPosition, setObjectPosition] = useState(initialState.objectPosition);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const activePhoto = useMemo(() => {
    if (mode === 'photo' && photo) return photo;
    return activeImages.find((img) => img.id === selectedPhotoId) || null;
  }, [activeImages, mode, photo, selectedPhotoId]);

  const filteredPickerImages = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activeImages.filter((img) => {
      if (categoryFilter === 'favorites' && !img.isFavorite) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'favorites' && img.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${img.title || ''} ${img.description || ''} ${img.category || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeImages, categoryFilter, searchTerm]);

  const slotMeta = getSlotMeta(targetSlot);
  const normalizedMedia = useMemo(() => normalizeLandingMedia(landingMedia), [landingMedia]);

  function handleSelectPickerPhoto(pickedImg) {
    setSelectedPhotoId(pickedImg.id);

    if (targetSlot === 'hero') {
      if (!heroAlt.trim()) {
        setHeroAlt(pickedImg.title || '');
      }
    } else if (targetSlot === 'extra') {
      setExtraTitle(pickedImg.title || '');
      setExtraCaption(pickedImg.description || '');
    } else {
      const slotDefault = LANDING_MEDIA_SPOT_DEFAULTS.find((s) => s.slotKey === targetSlot);
      setSpotDrafts((current) => ({
        ...current,
        [targetSlot]: {
          badge: current[targetSlot]?.badge || slotDefault?.badge || '',
          title: pickedImg.title || current[targetSlot]?.title || slotDefault?.title || '',
          caption: pickedImg.description || current[targetSlot]?.caption || slotDefault?.caption || '',
        },
      }));
    }
  }

  function toggleSpotSelection(slotKey) {
    setSelectedSpots((current) => {
      const exists = current.includes(slotKey);
      const next = exists ? current.filter((item) => item !== slotKey) : [...current, slotKey];
      if (!exists) {
        setActiveTextTab(slotKey);
      } else if (activeTextTab === slotKey && next.length > 0) {
        setActiveTextTab(next[0]);
      }
      return next;
    });
  }

  function updateSpotDraft(slotKey, field, value) {
    setSpotDrafts((current) => ({
      ...current,
      [slotKey]: {
        ...(current[slotKey] || {}),
        [field]: value,
      },
    }));
  }

  function handleAutofillFromGalleryPhoto(slotKey) {
    if (!activePhoto) return;
    setSpotDrafts((current) => ({
      ...current,
      [slotKey]: {
        ...(current[slotKey] || {}),
        title: activePhoto.title || current[slotKey]?.title || '',
        caption: activePhoto.description || current[slotKey]?.caption || '',
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;

    const nextMedia = normalizeLandingMedia(normalizedMedia);
    const nowIso = new Date().toISOString();

    if (mode === 'photo' && photo) {
      // Update Hero slot based on heroSelected checkbox
      const wasHeroThisPhoto =
        nextMedia.hero.galleryId === photo.id || (nextMedia.hero.url && nextMedia.hero.url === photo.url);

      if (heroSelected) {
        nextMedia.hero = {
          galleryId: photo.id,
          url: photo.url,
          alt: heroAlt.trim() || photo.title || '',
          objectPosition,
        };
      } else if (wasHeroThisPhoto) {
        nextMedia.hero = {
          galleryId: '',
          url: '',
          alt: '',
          objectPosition: '50% 48%',
        };
      }

      // Update Pratinjau spots 01-03
      nextMedia.spots = LANDING_MEDIA_SPOT_DEFAULTS.map((slotDefault) => {
        const existingSpot = nextMedia.spots.find((s) => s.slotKey === slotDefault.slotKey) || {
          slotKey: slotDefault.slotKey,
          galleryId: '',
          url: '',
          badge: '',
          title: '',
          caption: '',
          objectPosition: '',
        };
        const isSelected = selectedSpots.includes(slotDefault.slotKey);
        const wasThisPhoto =
          existingSpot.galleryId === photo.id || (existingSpot.url && existingSpot.url === photo.url);

        if (isSelected) {
          const draft = spotDrafts[slotDefault.slotKey] || {};
          return {
            slotKey: slotDefault.slotKey,
            galleryId: photo.id,
            url: photo.url,
            badge: (draft.badge || '').trim() || slotDefault.badge,
            title: (draft.title || '').trim() || photo.title || slotDefault.title,
            caption: (draft.caption || '').trim() || photo.description || slotDefault.caption,
            objectPosition,
          };
        }

        if (wasThisPhoto) {
          return {
            slotKey: slotDefault.slotKey,
            galleryId: '',
            url: '',
            badge: '',
            title: '',
            caption: '',
            objectPosition: '',
          };
        }

        return existingSpot;
      });

      // Update Extra Documentation list
      const existingExtraIdx = nextMedia.galleryExtras.findIndex(
        (item) => item.galleryId === photo.id || (item.url && item.url === photo.url),
      );
      if (extraSelected) {
        const nextItem = {
          galleryId: photo.id,
          url: photo.url,
          title: extraTitle.trim() || photo.title || '',
          caption: extraCaption.trim() || photo.description || '',
          category: categories.find((c) => c.value === photo.category)?.label || photo.category || '',
          objectPosition,
        };
        if (existingExtraIdx >= 0) {
          nextMedia.galleryExtras[existingExtraIdx] = nextItem;
        } else {
          nextMedia.galleryExtras = [nextItem, ...nextMedia.galleryExtras].slice(0, 12);
        }
      } else if (existingExtraIdx >= 0) {
        nextMedia.galleryExtras = nextMedia.galleryExtras.filter((_item, idx) => idx !== existingExtraIdx);
      }

      nextMedia.updatedAt = nowIso;
      await onSave(normalizeLandingMedia(nextMedia), photo);
      return;
    }

    // mode === 'slot'
    if (!activePhoto) return;

    if (targetSlot === 'hero') {
      nextMedia.hero = {
        galleryId: activePhoto.id,
        url: activePhoto.url,
        alt: heroAlt.trim() || activePhoto.title || '',
        objectPosition,
      };
    } else if (targetSlot === 'extra') {
      const nextItem = {
        galleryId: activePhoto.id,
        url: activePhoto.url,
        title: extraTitle.trim() || activePhoto.title || '',
        caption: extraCaption.trim() || activePhoto.description || '',
        category: categories.find((c) => c.value === activePhoto.category)?.label || activePhoto.category || '',
        objectPosition,
      };
      const existingIdx = nextMedia.galleryExtras.findIndex(
        (item) => item.galleryId === activePhoto.id || item.url === activePhoto.url,
      );
      if (existingIdx >= 0) {
        nextMedia.galleryExtras[existingIdx] = nextItem;
      } else {
        nextMedia.galleryExtras = [...nextMedia.galleryExtras, nextItem].slice(0, 12);
      }
    } else {
      const slotDefault = LANDING_MEDIA_SPOT_DEFAULTS.find((s) => s.slotKey === targetSlot);
      const draft = spotDrafts[targetSlot] || {};
      nextMedia.spots = LANDING_MEDIA_SPOT_DEFAULTS.map((def) => {
        if (def.slotKey !== targetSlot) {
          return nextMedia.spots.find((s) => s.slotKey === def.slotKey) || {
            slotKey: def.slotKey,
            galleryId: '',
            url: '',
            badge: '',
            title: '',
            caption: '',
            objectPosition: '',
          };
        }
        return {
          slotKey: targetSlot,
          galleryId: activePhoto.id,
          url: activePhoto.url,
          badge: (draft.badge || '').trim() || slotDefault?.badge || '',
          title: (draft.title || '').trim() || activePhoto.title || slotDefault?.title || '',
          caption: (draft.caption || '').trim() || activePhoto.description || slotDefault?.caption || '',
          objectPosition,
        };
      });
    }

    nextMedia.updatedAt = nowIso;
    await onSave(normalizeLandingMedia(nextMedia), activePhoto);
  }

  const previewUrl = activePhoto?.url || LANDING_HERO_DEFAULT_URL;
  const currentEditingSpotKey = mode === 'photo'
    ? (selectedSpots.includes(activeTextTab) ? activeTextTab : selectedSpots[0] || null)
    : (targetSlot.startsWith('spot') ? targetSlot : null);
  const currentSpotDraft = currentEditingSpotKey ? (spotDrafts[currentEditingSpotKey] || {}) : null;
  const hasExistingCustomSlot =
    mode === 'slot' &&
    targetSlot !== 'extra' &&
    Boolean(
      targetSlot === 'hero'
        ? normalizedMedia.hero.url
        : normalizedMedia.spots.find((s) => s.slotKey === targetSlot)?.url,
    );

  return (
    <div
      className="gallery-modal-layer"
      data-gallery-landing-modal="ui-11-spatial"
    >
      <button
        type="button"
        className="gallery-modal-backdrop"
        aria-label="Tutup pengatur foto landing page"
        onClick={onClose}
        disabled={isSaving}
      />

      <section
        className="gallery-modal-panel gallery-landing-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-landing-modal-title"
      >
        <header className="gallery-modal-header">
          <div className="gallery-modal-title">
            <span aria-hidden="true">
              <Globe size={17} />
            </span>

            <div>
              <small>{mode === 'photo' ? 'Publikasi foto ke website' : `Konfigurasi · ${slotMeta.label}`}</small>
              <h3 id="gallery-landing-modal-title">
                {mode === 'photo'
                  ? 'Atur Foto di Landing Page'
                  : `Pilih Foto untuk ${slotMeta.label}`}
              </h3>
            </div>
          </div>

          <button
            type="button"
            className="gallery-modal-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup"
          >
            <X size={17} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="gallery-modal-form gallery-landing-modal-form">
          {mode === 'slot' ? (
            <div className="gallery-landing-picker-block">
              <div className="gallery-landing-picker-head">
                <div className="gallery-landing-picker-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Cari foto dari galeri..."
                    aria-label="Cari foto dari galeri"
                  />
                </div>

                {onOpenUpload ? (
                  <button
                    type="button"
                    className="gallery-landing-head-btn"
                    onClick={() => {
                      onClose();
                      onOpenUpload();
                    }}
                  >
                    <Plus size={13} aria-hidden="true" />
                    <span>Upload Baru</span>
                  </button>
                ) : null}
              </div>

              <div className="gallery-landing-picker-filters" role="group" aria-label="Filter kategori galeri">
                <button
                  type="button"
                  className={categoryFilter === 'all' ? 'is-active' : ''}
                  onClick={() => setCategoryFilter('all')}
                >
                  Semua ({activeImages.length})
                </button>
                <button
                  type="button"
                  className={categoryFilter === 'favorites' ? 'is-active' : ''}
                  onClick={() => setCategoryFilter('favorites')}
                >
                  Favorit
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    className={categoryFilter === cat.value ? 'is-active' : ''}
                    onClick={() => setCategoryFilter(cat.value)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {filteredPickerImages.length === 0 ? (
                <div className="gallery-landing-picker-empty">
                  <ImageIcon size={24} aria-hidden="true" />
                  <strong>Belum ada foto yang cocok</strong>
                  <p>Upload foto studio terlebih dahulu atau ubah kata kunci pencarian.</p>
                </div>
              ) : (
                <div className="gallery-landing-picker-grid" role="listbox" aria-label="Daftar foto galeri">
                  {filteredPickerImages.map((item) => {
                    const isPicked = selectedPhotoId === item.id;
                    const itemAssignments = getPhotoLandingAssignments(item, { landingMedia: normalizedMedia });

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isPicked}
                        className={`gallery-landing-picker-item${isPicked ? ' is-picked' : ''}`}
                        onClick={() => handleSelectPickerPhoto(item)}
                      >
                        <img
                          src={item.url}
                          alt={item.title || 'Foto galeri'}
                          loading="lazy"
                        />
                        {isPicked ? (
                          <span className="gallery-landing-picker-check" aria-hidden="true">
                            <Check size={13} />
                          </span>
                        ) : null}
                        {itemAssignments.badges.length > 0 ? (
                          <span className="gallery-landing-picker-tag">
                            {itemAssignments.badges.join(' · ')}
                          </span>
                        ) : null}
                        <span className="gallery-landing-picker-title">
                          {item.title || 'Tanpa judul'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <div className="gallery-landing-modal-preview-row">
            <div className="gallery-landing-modal-preview-frame">
              <img
                src={previewUrl}
                alt={activePhoto?.title || 'Pratinjau foto landing page'}
                style={{ objectPosition: objectPosition || '50% 50%' }}
              />
              <span className="gallery-landing-modal-preview-pill">
                {activePhoto ? 'Live Frame Preview' : 'Preview Default Bawaan'}
              </span>
            </div>

            <div className="gallery-landing-focus-controls">
              <span className="gallery-field-label">Titik Fokus Gambar (Framing)</span>
              <div className="gallery-landing-focus-pills">
                {LANDING_MEDIA_FOCUS_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={objectPosition === preset.key ? 'is-active' : ''}
                    disabled={isSaving}
                    onClick={() => setObjectPosition(preset.key)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <small className="gallery-landing-focus-hint">
                Membantu bagian terpenting studio tetap berada di tengah bingkai pada layar desktop maupun HP.
              </small>
            </div>
          </div>

          {mode === 'photo' ? (
            <div className="gallery-landing-target-group">
              <span className="gallery-field-label">Tampilkan Foto Ini Di:</span>

              <div className="gallery-landing-target-grid">
                <label className={`gallery-landing-target-option${heroSelected ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={heroSelected}
                    disabled={isSaving}
                    onChange={(event) => setHeroSelected(event.target.checked)}
                  />
                  <span>
                    <strong>Foto Utama Hero</strong>
                    <small>Banner utama di bagian paling atas halaman</small>
                  </span>
                </label>

                {LANDING_MEDIA_SPOT_DEFAULTS.map((slotDef) => {
                  const isChecked = selectedSpots.includes(slotDef.slotKey);
                  return (
                    <label
                      key={slotDef.slotKey}
                      className={`gallery-landing-target-option${isChecked ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isSaving}
                        onChange={() => toggleSpotSelection(slotDef.slotKey)}
                      />
                      <span>
                        <strong>{slotDef.slotLabel}</strong>
                        <small>{slotDef.badge}</small>
                      </span>
                    </label>
                  );
                })}

                <label className={`gallery-landing-target-option${extraSelected ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={extraSelected}
                    disabled={isSaving}
                    onChange={(event) => setExtraSelected(event.target.checked)}
                  />
                  <span>
                    <strong>Galeri Dokumentasi Tambahan</strong>
                    <small>Strip foto ekstra di bawah Pratinjau Ruang</small>
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          {((mode === 'photo' && heroSelected) || (mode === 'slot' && targetSlot === 'hero')) ? (
            <label className="gallery-field">
              <span className="gallery-field-label">Deskripsi Alt / Judul Aksesibilitas Hero</span>
              <input
                type="text"
                disabled={isSaving}
                value={heroAlt}
                onChange={(event) => setHeroAlt(event.target.value)}
                placeholder="Contoh: Ruang kontrol utama 37 Music Studio dengan monitor aktif"
              />
            </label>
          ) : null}

          {currentEditingSpotKey && currentSpotDraft ? (
            <div className="gallery-landing-spot-editor">
              {mode === 'photo' && selectedSpots.length > 1 ? (
                <div className="gallery-landing-spot-subtabs" role="tablist" aria-label="Pilih slot untuk edit teks">
                  {selectedSpots.map((spotKey) => {
                    const def = LANDING_MEDIA_SPOT_DEFAULTS.find((d) => d.slotKey === spotKey);
                    return (
                      <button
                        key={spotKey}
                        type="button"
                        role="tab"
                        aria-selected={currentEditingSpotKey === spotKey}
                        className={currentEditingSpotKey === spotKey ? 'is-active' : ''}
                        onClick={() => setActiveTextTab(spotKey)}
                      >
                        Slot {def?.shortLabel}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="gallery-landing-spot-editor-head">
                <span className="gallery-field-label">
                  Teks Kartu {getSlotMeta(currentEditingSpotKey).label}
                </span>

                {activePhoto ? (
                  <button
                    type="button"
                    className="gallery-landing-autofill-btn"
                    onClick={() => handleAutofillFromGalleryPhoto(currentEditingSpotKey)}
                    disabled={isSaving}
                  >
                    <Sparkles size={12} aria-hidden="true" />
                    <span>Ambil dari Judul & Deskripsi Foto</span>
                  </button>
                ) : null}
              </div>

              <div className="gallery-landing-spot-inputs">
                <label className="gallery-field">
                  <span className="gallery-field-label">Label Sudut</span>
                  <input
                    type="text"
                    disabled={isSaving}
                    value={currentSpotDraft.badge || ''}
                    onChange={(event) => updateSpotDraft(currentEditingSpotKey, 'badge', event.target.value)}
                    placeholder="Contoh: Meja Kontrol & Monitoring"
                  />
                </label>

                <label className="gallery-field">
                  <span className="gallery-field-label">Judul Kartu</span>
                  <input
                    type="text"
                    disabled={isSaving}
                    value={currentSpotDraft.title || ''}
                    onChange={(event) => updateSpotDraft(currentEditingSpotKey, 'title', event.target.value)}
                    placeholder="Contoh: Ruang kerja untuk mendengar detail lagu dengan jelas"
                  />
                </label>

                <label className="gallery-field">
                  <span className="gallery-field-label">Caption Singkat</span>
                  <textarea
                    disabled={isSaving}
                    value={currentSpotDraft.caption || ''}
                    onChange={(event) => updateSpotDraft(currentEditingSpotKey, 'caption', event.target.value)}
                    placeholder="Deskripsi singkat suasana atau perlengkapan di foto ini."
                  />
                </label>
              </div>
            </div>
          ) : null}

          {((mode === 'photo' && extraSelected) || (mode === 'slot' && targetSlot === 'extra')) ? (
            <div className="gallery-landing-spot-inputs">
              <label className="gallery-field">
                <span className="gallery-field-label">Judul Foto di Galeri Tambahan</span>
                <input
                  type="text"
                  disabled={isSaving}
                  value={extraTitle}
                  onChange={(event) => setExtraTitle(event.target.value)}
                  placeholder="Contoh: Live Drum Tracking Session"
                />
              </label>

              <label className="gallery-field">
                <span className="gallery-field-label">Caption Galeri Tambahan (Opsional)</span>
                <input
                  type="text"
                  disabled={isSaving}
                  value={extraCaption}
                  onChange={(event) => setExtraCaption(event.target.value)}
                  placeholder="Keterangan singkat yang muncul di bawah foto."
                />
              </label>
            </div>
          ) : null}

          <div className="gallery-landing-modal-footer">
            {hasExistingCustomSlot && onResetSlot ? (
              <button
                type="button"
                className="gallery-secondary-button is-reset"
                disabled={isSaving}
                onClick={async () => {
                  await onResetSlot(targetSlot);
                  onClose();
                }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>Kembalikan Default</span>
              </button>
            ) : null}

            <div className="gallery-landing-modal-footer-right">
              <button
                type="button"
                className="gallery-secondary-button"
                onClick={onClose}
                disabled={isSaving}
              >
                Batal
              </button>

              <button
                type="submit"
                className="gallery-primary-button"
                disabled={isSaving || (mode === 'slot' && !activePhoto)}
              >
                {isSaving ? 'Menyimpan...' : 'Simpan ke Landing Page'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
