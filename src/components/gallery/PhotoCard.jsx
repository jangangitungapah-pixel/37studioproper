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
      className={`group aspect-square bg-zinc-950 overflow-hidden relative cursor-pointer transition-all duration-200 border border-transparent ${
        isSelected
          ? 'ring-2 ring-orange-500'
          : 'hover:opacity-90'
      }`}
    >
      <img
        src={img.url}
        alt={img.title}
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        loading="lazy"
      />

      {isSelectMode && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectToggle(img.id);
          }}
          className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full border flex items-center justify-center backdrop-blur-md transition-all shadow-md"
          style={{
            backgroundColor: isSelected ? 'var(--ui-accent, #f97316)' : 'rgba(0, 0, 0, 0.4)',
            borderColor: isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.3)',
            color: isSelected ? '#000000' : '#ffffff',
          }}
        >
          <Check size={16} className="stroke-[3px]" />
        </button>
      )}

      {!isSelectMode && !isDeletedTab && img.isFavorite && (
        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-red-500 backdrop-blur-md border border-white/10 z-10">
          <Heart size={12} className="fill-current" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/5 text-[8px] text-zinc-300 font-bold uppercase tracking-wider z-10">
        {categories.find((category) => category.value === img.category)?.label || 'Lain-lain'}
      </div>

      {!isSelectMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
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
                className="p-1.5 rounded-lg bg-red-500/80 text-white border border-red-500/20 hover:bg-red-600 transition-all backdrop-blur-md"
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
                className="p-1.5 rounded-lg bg-emerald-500/80 text-white border border-emerald-500/20 hover:bg-emerald-600 transition-all backdrop-blur-md"
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
                className="p-1.5 rounded-lg bg-red-500/80 text-white border border-red-500/20 hover:bg-red-600 transition-all backdrop-blur-md"
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
