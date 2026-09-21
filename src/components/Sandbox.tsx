// SPDX-License-Identifier: Apache-2.0
import { motion } from 'motion/react'
import { SlidersHorizontal, ExternalLink } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export default function Sandbox() {
  const { t } = useLanguage()
  return (
    <section className="py-16 px-6 max-w-7xl mx-auto border-t border-zinc-800/50">
      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
        className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
          <SlidersHorizontal className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">{t('sandboxTitle')}</h2>
          <p className="text-zinc-400 leading-relaxed">{t('sandboxDesc')}</p>
        </div>
        <a href="https://tree-ensemble-playground.vercel.app" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-zinc-950 text-sm font-semibold hover:opacity-85 transition-opacity shrink-0">
          {t('sandboxCTA')} <ExternalLink className="w-4 h-4" />
        </a>
      </motion.div>
    </section>
  )
}
