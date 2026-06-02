type BadgeVariant = 'recluta' | 'activo' | 'donado' | 'tag'

const styles: Record<BadgeVariant, string> = {
  recluta: 'bg-sand/20 text-sand border border-sand/30',
  activo: 'bg-military/40 text-bone border border-military',
  donado: 'bg-white/10 text-bone/50 border border-white/10',
  tag: 'bg-white/5 text-bone/70 border border-white/10',
}

export function Badge({ label, variant = 'tag' }: { label: string; variant?: BadgeVariant }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-sm uppercase tracking-wider ${styles[variant]}`}>
      {label}
    </span>
  )
}
