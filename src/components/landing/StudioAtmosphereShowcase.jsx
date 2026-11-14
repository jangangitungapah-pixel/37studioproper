import { CheckCircle2, Eye } from 'lucide-react';
import {
  STUDIO_FRAME_SPOTS,
  STUDIO_HERO_PHOTO,
  STUDIO_READINESS_POINTS,
} from './landingData.js';

export default function StudioAtmosphereShowcase({
  studioName,
  spots = STUDIO_FRAME_SPOTS,
  extraPhotos = [],
}) {
  const resolvedSpots = Array.isArray(spots) && spots.length ? spots : STUDIO_FRAME_SPOTS;

  return (
    <section
      id="atmosphere"
      tabIndex={-1}
      className="client-landing-atmosphere"
      aria-labelledby="atmosphere-heading"
    >
      <div className="client-landing-atmosphere-header">
        <div className="client-landing-atmosphere-heading-col">
          <span className="client-landing-kicker">
            <Eye size={14} aria-hidden="true" />
            Pratinjau Ruang
          </span>
          <h2 id="atmosphere-heading">
            Rasakan suasana ruang sebelum melangkah masuk.
          </h2>
        </div>

        <p className="client-landing-atmosphere-lead">
          Tiga sudut pandang ruang {studioName} agar Anda dapat membayangkan
          tata letak kontrol, area santai, dan sudut instrumen sebelum sesi dimulai.
        </p>
      </div>

      <div className="client-landing-atmosphere-grid">
        {resolvedSpots.map((spot, index) => {
          const isCustomSpot = Boolean(spot.isCustom && spot.url);
          const imageSrc = spot.url || STUDIO_HERO_PHOTO;
          const imageScale = isCustomSpot ? 1 : (spot.scale || 1.04);

          return (
            <figure
              key={spot.id || spot.slotKey || index}
              className={`client-landing-atmosphere-card${spot.featured ? ' is-featured' : ''}`}
            >
              <div className="client-landing-atmosphere-media">
                <img
                  src={imageSrc}
                  alt={`${studioName} — ${spot.badge}: ${spot.caption}`}
                  loading="lazy"
                  decoding="async"
                  style={{
                    objectPosition: spot.objectPosition || '50% 50%',
                    transformOrigin: isCustomSpot ? 'center' : (spot.transformOrigin || 'center'),
                    transform: imageScale === 1 ? undefined : `scale(${imageScale})`,
                  }}
                />
              </div>

              <figcaption className="client-landing-atmosphere-caption">
                <span className="client-landing-atmosphere-badge">
                  {String(index + 1).padStart(2, '0')} · {spot.badge}
                </span>
                <h3>{spot.title}</h3>
                <p>{spot.caption}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {extraPhotos.length > 0 ? (
        <div className="client-landing-extra-gallery" aria-label="Galeri foto studio pilihan">
          <div className="client-landing-extra-header">
            <span>Dokumentasi Studio</span>
            <small>{extraPhotos.length} foto pilihan dari galeri aktif</small>
          </div>

          <div className="client-landing-extra-grid">
            {extraPhotos.map((item, idx) => (
              <figure
                key={item.galleryId || `${item.url}-${idx}`}
                className="client-landing-extra-card"
              >
                <div className="client-landing-extra-media">
                  <img
                    src={item.url}
                    alt={`${studioName} — ${item.title || item.category || 'Foto studio'}`}
                    loading="lazy"
                    decoding="async"
                    style={{
                      objectPosition: item.objectPosition || '50% 50%',
                    }}
                  />
                </div>

                {(item.category || item.title || item.caption) ? (
                  <figcaption className="client-landing-extra-caption">
                    {item.category ? <small>{item.category}</small> : null}
                    {item.title ? <strong>{item.title}</strong> : null}
                    {item.caption ? <p>{item.caption}</p> : null}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="client-landing-readiness-strip" aria-label="Standar alur ruang studio">
        {STUDIO_READINESS_POINTS.map((point) => (
          <li key={point}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
