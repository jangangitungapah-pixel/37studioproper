import {
  Image as ImageIcon,
} from 'lucide-react';

const COPY = {
  trash: {
    eyebrow: 'Recycle bin',
    title: 'Tempat sampah kosong',
    body:
      'Belum ada media terhapus yang perlu dipulihkan atau dihapus permanen.',
  },

  albums_detail: {
    eyebrow: 'Album',
    title: 'Album ini masih kosong',
    body:
      'Belum ada foto yang masuk ke koleksi ini.',
  },

  photos: {
    eyebrow: 'Media library',
    title: 'Belum ada foto di gallery',
    body:
      'Upload media pertama untuk mulai membangun visual archive studio.',
  },

  albums: {
    eyebrow: 'Collections',
    title: 'Belum ada album',
    body:
      'Album akan terbentuk dari kategori media yang tersedia.',
  },
};

export default function EmptyGalleryState({
  activeTab,
}) {
  const copy =
    COPY[activeTab] || COPY.photos;

  return (
    <div className="gallery-empty-state">
      <span
        className="gallery-empty-icon"
        aria-hidden="true"
      >
        <ImageIcon size={28} />
      </span>

      <small>{copy.eyebrow}</small>
      <strong>{copy.title}</strong>
      <p>{copy.body}</p>
    </div>
  );
}
