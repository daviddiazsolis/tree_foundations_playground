// SPDX-License-Identifier: Apache-2.0
import { Globe, Github } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="border-t border-zinc-800 py-8 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-3 text-center">
        <p className="text-zinc-400 text-sm">{t('footerCreatedBy')} <span className="text-zinc-200 font-medium">David Díaz {t('footerRole')}</span></p>
        <p className="text-zinc-500 text-xs italic">{t('footerLiveCoded')}</p>
        <div className="flex items-center gap-6 text-sm mt-1">
          <a href="https://daviddiazsolis.com" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1.5"><Globe className="w-4 h-4" /> daviddiazsolis.com</a>
          <a href="https://github.com/daviddiazsolis" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1.5"><Github className="w-4 h-4" /> GitHub</a>
        </div>
      </div>
    </footer>
  )
}
