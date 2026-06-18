import { Image as ImageIcon } from 'lucide-react';

export default function EmptyGalleryState({ activeTab }) {
  return (
    <div className="gallery-empty-state text-center py-24 rounded-[22px] border border-dashed border-[var(--auth-border)] bg-[var(--auth-bg-soft)]/50 p-6 space-y-4 max-w-lg mx-auto">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5">
        <ImageIcon className="text-zinc-600 w-8 h-8 opacity-65" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-white">
          {activeTab === 'trash' && 'Tempat Sampah Kosong'}
          {activeTab === 'albums_detail' && 'Album Ini Kosong'}
          {activeTab === 'photos' && 'Katalog Galeri Foto Kosong'}
          {activeTab === 'albums' && 'Belum Ada Album'}
        </h4>
        <p className="text-xs text-[var(--ui-text-muted)] max-w-sm mx-auto leading-relaxed">
          {activeTab === 'trash' && 'Tidak ada item baru-baru ini yang dibuang ke sampah.'}
          {activeTab === 'albums_detail' && 'Belum ada foto yang masuk ke kategori/album ini.'}
          {activeTab === 'photos' && 'Silakan unggah foto portofolio pertama Anda dengan mengeklik tombol "Unggah Foto" di kanan atas.'}
        </p>
      </div>
    </div>
  );
}
