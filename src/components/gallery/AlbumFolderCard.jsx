import { Folder } from 'lucide-react';

export default function AlbumFolderCard({
  title,
  count,
  coverUrl,
  onClick,
  icon: FolderIcon = Folder,
  iconColor = 'text-orange-500',
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer space-y-3"
    >
      <div className="aspect-[4/3] rounded-[22px] bg-[var(--auth-bg-soft)] border border-[var(--auth-border)] p-2 relative overflow-hidden group-hover:border-[var(--auth-border-strong)] group-hover:-translate-y-1 transition-all duration-300 flex flex-col justify-end shadow-md">
        {coverUrl ? (
          <div className="absolute inset-0 z-0">
            <img
              src={coverUrl}
              alt={title}
              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 blur-[1px] group-hover:blur-0"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-zinc-950/40 flex items-center justify-center">
            <FolderIcon className={`w-12 h-12 ${iconColor} opacity-20`} />
          </div>
        )}

        <div className="absolute top-3.5 right-3.5 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/5 text-[9px] font-bold text-zinc-300">
          {count} Item
        </div>

        <div className="relative z-10 p-2.5 rounded-2xl bg-black/60 backdrop-blur-md w-fit border border-white/5 mb-1 text-white group-hover:text-[var(--ui-accent)] transition-colors">
          <FolderIcon size={16} className={iconColor} />
        </div>
      </div>

      <div className="px-1 text-left">
        <h4 className="text-xs font-bold text-white group-hover:text-[var(--ui-accent)] transition-colors line-clamp-1">{title}</h4>
        <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{count} Foto</p>
      </div>
    </div>
  );
}
