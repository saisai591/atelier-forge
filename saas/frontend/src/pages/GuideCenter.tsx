import { ArrowLeft, HardDrive, MonitorCog, Network, PackageCheck, Printer, Search, ShieldCheck, Smartphone, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import ThemeToggle from '../components/ThemeToggle'
import { useThemeMode } from '../hooks/useThemeMode'

const guides = [
  {
    title: 'Installation appliance',
    icon: Network,
    tags: ['reseau', 'client', 'premier demarrage'],
    steps: ['Brancher le serveur au switch atelier.', 'Ouvrir le dashboard AtelierOS.', 'Verifier API, PXE, SMB et stockage.', 'Lancer regeneration reseau si l IP a change.'],
  },
  {
    title: 'Boot PXE',
    icon: MonitorCog,
    tags: ['pxe', 'uefi', 'audit'],
    steps: ['Activer UEFI Network Stack.', 'Activer PXE IPv4.', 'Desactiver Secure Boot si le modele bloque.', 'Demarrer sur Network IPv4.', 'Verifier le retour dans Audit.'],
  },
  {
    title: 'Images WIM',
    icon: HardDrive,
    tags: ['iso', 'wim', 'windows'],
    steps: ['Deposer l ISO dans le stockage reseau.', 'Ouvrir Images WIM.', 'Importer ou declarer l image.', 'Associer drivers et unattend.', 'Valider image par defaut.'],
  },
  {
    title: 'Etiquettes Brother',
    icon: Printer,
    tags: ['brother', '29x90', '62mm'],
    steps: ['Choisir le rouleau reel installe.', 'Utiliser 29x90 ou 62 mm uniquement.', 'Verifier QR et code-barres.', 'Imprimer test avant serie.'],
  },
  {
    title: 'Reception atelier',
    icon: PackageCheck,
    tags: ['erp', 'palette', 'csv'],
    steps: ['Importer le fichier fournisseur.', 'Verifier les colonnes detectees.', 'Scanner les machines.', 'Creer palettes et zones.', 'Generer BL ou colisage en sortie.'],
  },
  {
    title: 'PDA / mobile',
    icon: Smartphone,
    tags: ['unitech', 'scanner', 'mobile'],
    steps: ['Ouvrir /mobile sur le terminal.', 'Scanner QR ou code-barres.', 'Verifier fiche machine.', 'Marquer le statut atelier.'],
  },
  {
    title: 'Diagnostic support',
    icon: Wrench,
    tags: ['support', 'logs', 'sauvegarde'],
    steps: ['Verifier dashboard services.', 'Lire logs PXE.', 'Exporter rapport support.', 'Creer sauvegarde appliance avant intervention lourde.'],
  },
]

export default function GuideCenter() {
  const { theme, isDark, toggleTheme } = useThemeMode()
  const [query, setQuery] = useState('')
  const pageClass = isDark ? 'bg-[#070a10] text-slate-100' : 'bg-slate-100 text-slate-950'
  const panelClass = isDark ? 'border-white/10 bg-white/[0.04] shadow-black/30' : 'border-slate-200 bg-white shadow-slate-200/70'
  const inputClass = isDark ? 'border-white/10 bg-black/20 text-white placeholder:text-slate-600' : 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400'
  const titleClass = isDark ? 'text-white' : 'text-slate-950'
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600'
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return guides
    return guides.filter((guide) => `${guide.title} ${guide.tags.join(' ')} ${guide.steps.join(' ')}`.toLowerCase().includes(needle))
  }, [query])

  return (
    <main className={`min-h-screen ${pageClass}`}>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <header className={`flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Guide AtelierOS</p>
            <h1 className={`mt-2 text-3xl font-black tracking-tight ${titleClass}`}>Aide et procedures</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <a href="/" className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-black ${panelClass}`}>
              <ArrowLeft size={16} />
              Accueil
            </a>
          </div>
        </header>

        <section className={`mt-5 rounded-2xl border p-4 shadow-2xl ${panelClass}`}>
          <div className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${inputClass}`}>
            <Search className="h-5 w-5 text-cyan-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher: PXE, WIM, Brother, palette, mobile..."
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
            />
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((guide) => {
            const Icon = guide.icon
            return (
              <article key={guide.title} className={`rounded-2xl border p-5 shadow-2xl ${panelClass}`}>
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className={`text-lg font-black ${titleClass}`}>{guide.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {guide.tags.map((tag) => (
                        <span key={tag} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <ol className="mt-4 space-y-2">
                  {guide.steps.map((step, index) => (
                    <li key={step} className={`flex gap-2 text-sm font-semibold ${mutedClass}`}>
                      <span className="font-black text-cyan-300">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </article>
            )
          })}
        </section>

        <div className={`mt-5 rounded-2xl border p-4 ${panelClass}`}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <div className={`text-sm font-bold ${mutedClass}`}>Les guides restent ici. Les modules metier restent courts et operationnels.</div>
          </div>
        </div>
      </div>
    </main>
  )
}
