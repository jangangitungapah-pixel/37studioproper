import { Calendar, Check, Heart, RefreshCw, Trash, Trash2, User } from 'lucide-react';

export default function PhotoCard({
  categories = [],
  img,
  isDeletedTab = false,
  isSelectMode = false,
  isSelected = false,
  onSelectToggle,
  onCardClick,
  onFavoriteClick,
  onRestoreClick,
  onDeleteClick,
}) {
  return (
    <div
      onClick={onCardClick}
      className={`group rounded-[22px] bg-[var(--auth-bg-soft)] border overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative ${
        isSelected
          ? 'border-orange-500 ring-2 ring-orange-500/20'
          : 'border-[var(--auth-border)] hover:border-[var(--auth-border-strong)]'
      }`}
    >
      {isSelectMode && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectToggle(img.id);
          }}
          className="absolute top-3.5 left-3.5 z-20 p-1.5 rounded-lg border backdrop-blur-md transition-all shadow-md"
          style={{
            backgroundColor: isSelected ? 'var(--ui-accent)' : 'rgba(0, 0, 0, 0.6)',
            borderColor: isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
            color: isSelected ? '#000000' : '#ffffff',
          }}
        >
          <Check size={11} className="stroke-[3px]" />
        </button>
      )}

      <div className="relative aspect-[4/3] bg-zinc-950 overflow-hidden border-b border-[var(--auth-border)]">
        <img
          src={img.url}
          alt={img.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />

        {!isDeletedTab && img.isFavorite && (
          <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-red-500 backdrop-blur-md border border-[var(--auth-border)]">
            <Heart size={12} className="fill-current" />
          </div>
        )}

        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/5 text-[9px] text-zinc-300 font-bold uppercase tracking-wide">
          {categories.find((category) => category.value === img.category)?.label || 'Lain-lain'}
        </div>
      </div>

      <div className="p-4 space-y-2.5 flex-grow flex flex-col justify-between">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[var(--ui-accent)] transition-colors">{img.title}</h4>
          {img.description ? (
            <p className="text-[10px] text-[var(--ui-text-muted)] line-clamp-2 leading-relaxed">
              {img.description}
            </p>
          ) : (
            <p className="text-[10px] text-zinc-600 italic">Tidak ada deskripsi.</p>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--auth-border)] flex items-center justify-between text-[9px] text-[var(--auth-text-muted)]">
          <span className="flex items-center gap-1 font-medium">
            <User size={10} className="text-orange-500" />
            <span className="max-w-[70px] truncate">{img.uploadedBy?.split('@')[0]}</span>
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Calendar size={10} className="text-orange-500" />
            <span>{new Date(img.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
          </span>
        </div>
      </div>

      {!isSelectMode && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          {!isDeletedTab ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFavoriteClick();
                }}
                className={`p-1.5 rounded-lg border backdrop-blur-md transition-all ${
                  img.isFavorite
                    ? 'bg-red-500 text-white border-transparent'
                    : 'bg-black/60 text-zinc-300 hover:text-white border-white/10'
                }`}
                title="Favorit"
              >
                <Heart size={12} className={img.isFavorite ? 'fill-current' : ''} />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteClick();
                }}
                className="p-1.5 rounded-lg bg-red-500/25 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-black hover:border-transparent transition-all backdrop-blur-md"
                title="Pindahkan ke Tempat Sampah"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRestoreClick();
                }}
                className="p-1.5 rounded-lg bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black hover:border-transparent transition-all backdrop-blur-md"
                title="Pulihkan"
              >
                <RefreshCw size={12} />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteClick();
                }}
                className="p-1.5 rounded-lg bg-red-500/25 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white hover:border-transparent transition-all backdrop-blur-md"
                title="Hapus Permanen"
              >
                <Trash size={12} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
