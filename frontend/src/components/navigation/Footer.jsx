import { LogoMark } from './Navbar'

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-navy-500 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2 font-semibold text-navy-900">
          <LogoMark className="size-6 text-brand-700" /> Wise Laundry
        </div>
        <p>Laundry pickup, cleaning & live tracking · Bengaluru · © {new Date().getFullYear()} Wise Laundry</p>
      </div>
    </footer>
  )
}
