// SPDX-License-Identifier: Apache-2.0
import { motion } from 'motion/react'
import { BookOpen, ExternalLink } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const LINKS = [
  { k: 'refLink1', href: 'https://scikit-learn.org/stable/modules/tree.html' },
  { k: 'refLink2', href: 'https://hastie.su.domains/ElemStatLearn/' },
  { k: 'refLink3', href: 'https://github.com/daviddiazsolis/c50py' },
  { k: 'refLink4', href: 'https://pypi.org/project/c50py/' },
]

export default function References() {
  const { t } = useLanguage()
  return (
    <section className="py-16 px-6 max-w-7xl mx-auto border-t border-zinc-800/50 scroll-mt-24">
      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-7 h-7 text-amber-500" />
          <h2 className="text-3xl font-bold text-zinc-100">{t('refTitle')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-zinc-200 font-semibold mb-3">{t('refPapers')}</h3>
            <ul className="space-y-3">
              {['refBook1', 'refBook2', 'refBook3', 'refBook4'].map(k => (
                <li key={k} className="flex gap-2 text-zinc-400 text-sm">
                  <BookOpen className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-zinc-200 font-semibold mb-3">{t('refLinks')}</h3>
            <ul className="space-y-3">
              {LINKS.map(l => (
                <li key={l.k}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-amber-500 hover:text-amber-400 transition-colors text-sm">
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    {t(l.k)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
