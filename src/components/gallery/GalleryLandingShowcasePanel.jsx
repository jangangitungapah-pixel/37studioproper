import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Globe,
  Image as ImageIcon,
  Layers,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  LANDING_HERO_DEFAULT_URL,
  countCustomLandingSlots,
  resolveLandingAtmosphereSpots,
  resolveLandingExtraGalleryItems,
  resolveLandingHeroMedia,
} from '../../settings/studioSettings.js';

export default function GalleryLandingShowcasePanel({
  activeImagesCount = 0,
  canManage = true,
  isSaving = false,
  onMoveExtraPhoto,
  onOpenSlotPicker,
  onRemoveExtraPhoto,
  onResetAll,
  onResetSlot,
  onSwapSpots,
  studioSettings,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const heroMedia = resolveLandingHeroMedia(studioSettings);
  const spots = resolveLandingAtmosphereSpots(studioSettings);
  const extraPhotos = resolveLandingExtraGalleryItems(studioSettings);
  const customSlotCount = countCustomLandingSlots(studioSettings);
  const hasAnyCustomization = customSlotCount > 0 || extraPhotos.length > 0;

  const slotCards = [
    {
      slotKey: 'hero',
      shortLabel: 'HERO',
      slotLabel: 'Foto Utama Hero',
      slotDescription: 'Banner besar di bagian atas landing page.',
      url: heroMedia.url || LANDING_HERO_DEFAULT_URL,
      isCustom: heroMedia.isCustom,
      objectPosition: heroMedia.objectPosition,
      scale: 1,
      title: heroMedia.isCustom
        ? (heroMedia.alt || 'Foto kustom Hero banner')
        : 'Banner default ruang kontrol studio',
      spotIndex: -1,
    },
    ...spots.map((spot, spotIndex) => ({
      slotKey: spot.slotKey,
      shortLabel: `SLOT ${spot.shortLabel}`,
      slotLabel: spot.slotLabel,
      slotDescription: spot.badge,
      url: spot.url || LANDING_HERO_DEFAULT_URL,
      isCustom: spot.isCustom,
      objectPosition: spot.objectPosition,
      transformOrigin: spot.transformOrigin,
      scale: spot.isCustom ? 1 : spot.scale,
      title: spot.title,
      spotIndex,
    })),
  ];

  return (
    <section
      className={`gallery-landing-panel${isExpanded ? ' is-expanded' : ' is-collapsed'}`}
      aria-labelledby="gallery-landing-panel-title"
    >
      <div className="gallery-landing-panel-head">
        <div className="gallery-landing-panel-title-wrap">
          <span className="gallery-landing-panel-icon" aria-hidden="true">
            <Globe size={17} />
          </span>

          <div>
            <div className="gallery-landing-panel-eyebrow">
              <small>Public Website Showcase</small>
              <span className={`gallery-landing-status-pill${hasAnyCustomization ? ' is-custom' : ''}`}>
                {hasAnyCustomization
                  ? `${customSlotCount}/4 slot kustom${extraPhotos.length ? ` · +${extraPhotos.length} dokumentasi` : ''}`
                  : 'Default bawaan aktif'}
              </span>
            </div>

            <h3 id="gallery-landing-panel-title">
              Foto Tampil di Landing Page
            </h3>
            <p>
              Pilih foto dari galeri untuk Hero Banner, Pratinjau Ruang (01–03), dan galeri tambahan.
            </p>
          </div>
        </div>

        <div className="gallery-landing-panel-head-actions">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="gallery-landing-head-btn"
          >
            <span>Preview Landing</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>

          {hasAnyCustomization ? (
            <button
              type="button"
              className="gallery-landing-head-btn is-danger"
              onClick={onResetAll}
              disabled={!canManage || isSaving}
              title="Kembalikan semua foto landing ke default bawaan"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset Default</span>
            </button>
          ) : null}

          <button
            type="button"
            className="gallery-landing-head-btn is-toggle"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Ringkas' : 'Kelola Slot'}</span>
            {isExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="gallery-landing-panel-body">
          {!canManage ? (
            <p className="gallery-landing-permission-note" role="note">
              Mode lihat saja: diperlukan izin <strong>Settings</strong> untuk mengubah foto yang tampil di landing page publik.
            </p>
          ) : null}

          <div className="gallery-landing-slot-grid">
            {slotCards.map((slot) => (
              <article
                key={slot.slotKey}
                className={`gallery-landing-slot-card${slot.isCustom ? ' is-custom' : ''}`}
              >
                <div className="gallery-landing-slot-thumb">
                  <img
                    src={slot.url}
                    alt={`${slot.slotLabel}: ${slot.title}`}
                    loading="lazy"
                    style={{
                      objectPosition: slot.objectPosition || '50% 50%',
                      transformOrigin: slot.transformOrigin || 'center',
                      transform: slot.scale && slot.scale !== 1 ? `scale(${slot.scale})` : undefined,
                    }}
                  />

                  <span className="gallery-landing-slot-badge">
                    {slot.shortLabel}
                  </span>

                  <span className={`gallery-landing-source-pill${slot.isCustom ? ' is-custom' : ''}`}>
                    {slot.isCustom ? 'Custom' : 'Default'}
                  </span>
                </div>

                <div className="gallery-landing-slot-copy">
                  <small>{slot.slotLabel}</small>
                  <strong>{slot.slotDescription}</strong>
                  <p>{slot.title}</p>
                </div>

                <div className="gallery-landing-slot-actions">
                  <button
                    type="button"
                    className="gallery-landing-slot-btn is-primary"
                    onClick={() => onOpenSlotPicker(slot.slotKey)}
                    disabled={!canManage || isSaving}
                  >
                    <ImageIcon size={13} aria-hidden="true" />
                    <span>{slot.isCustom ? 'Ganti / Edit' : 'Pilih Foto'}</span>
                  </button>

                  {slot.spotIndex >= 0 && slot.spotIndex < 2 ? (
                    <button
                      type="button"
                      className="gallery-landing-slot-icon-btn"
                      onClick={() => onSwapSpots(slot.spotIndex, slot.spotIndex + 1)}
                      disabled={!canManage || isSaving}
                      title={`Tukar posisi dengan Slot 0${slot.spotIndex + 2}`}
                      aria-label={`Tukar posisi ${slot.slotLabel} dengan Slot 0${slot.spotIndex + 2}`}
                    >
                      <SlidersHorizontal size={13} aria-hidden="true" />
                    </button>
                  ) : null}

                  {slot.isCustom ? (
                    <button
                      type="button"
                      className="gallery-landing-slot-icon-btn is-reset"
                      onClick={() => onResetSlot(slot.slotKey)}
                      disabled={!canManage || isSaving}
                      title="Kembalikan slot ini ke default"
                      aria-label={`Reset ${slot.slotLabel} ke default`}
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="gallery-landing-extras-bar">
            <div className="gallery-landing-extras-meta">
              <Layers size={14} aria-hidden="true" />
              <span>
                <strong>Dokumentasi Tambahan</strong>
                <small>
                  {extraPhotos.length > 0
                    ? `${extraPhotos.length}/12 foto tampil di bawah Pratinjau Ruang`
                    : `Opsional — pilih foto ekstra (${activeImagesCount} media aktif tersedia)`}
                </small>
              </span>
            </div>

            <button
              type="button"
              className="gallery-landing-head-btn"
              onClick={() => onOpenSlotPicker('extra')}
              disabled={!canManage || isSaving}
            >
              <Plus size={13} aria-hidden="true" />
              <span>Tambah ke Dokumentasi</span>
            </button>
          </div>

          {extraPhotos.length > 0 ? (
            <div className="gallery-landing-extras-strip" aria-label="Urutan foto dokumentasi landing page">
              {extraPhotos.map((item, idx) => (
                <div key={item.galleryId || `${item.url}-${idx}`} className="gallery-landing-extra-chip">
                  <img
                    src={item.url}
                    alt={item.title || 'Foto dokumentasi landing'}
                    style={{ objectPosition: item.objectPosition || '50% 50%' }}
                  />
                  <div className="gallery-landing-extra-chip-info">
                    <strong>{item.title || 'Tanpa judul'}</strong>
                    <small>{item.category || 'Studio Gallery'}</small>
                  </div>

                  <div className="gallery-landing-extra-chip-actions">
                    <button
                      type="button"
                      disabled={!canManage || isSaving || idx === 0}
                      onClick={() => onMoveExtraPhoto(idx, -1)}
                      aria-label="Geser ke kiri"
                      title="Geser ke kiri"
                    >
                      <ArrowLeft size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={!canManage || isSaving || idx === extraPhotos.length - 1}
                      onClick={() => onMoveExtraPhoto(idx, 1)}
                      aria-label="Geser ke kanan"
                      title="Geser ke kanan"
                    >
                      <ArrowRight size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="is-remove"
                      disabled={!canManage || isSaving}
                      onClick={() => onRemoveExtraPhoto(item)}
                      aria-label="Hapus dari dokumentasi landing"
                      title="Keluarkan dari landing page"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="gallery-landing-extras-hint">
              <Sparkles size={13} aria-hidden="true" />
              <span>
                Tip: Klik ikon bola dunia (<Globe size={12} aria-hidden="true" />) pada kartu foto mana saja di bawah untuk langsung menempatkannya di landing page.
              </span>
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
