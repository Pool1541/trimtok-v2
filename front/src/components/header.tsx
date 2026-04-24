export function Header() {
  return (
    <header className="flex flex-col items-center pt-8 pb-2 gap-1">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
          <img src="/trimtok-icon.png" alt="TrimTok Logo" className="w-7 h-7" />
        </div>
        <span className="text-xl font-bold text-white">TrimTok</span>
      </div>
      <p className="text-sm text-(--trimtok-text-muted)">
        Descarga y recorta videos de TikTok
      </p>
    </header>
  )
}
