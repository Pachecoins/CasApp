export type SoldierEstado = 'recluta' | 'activo' | 'donado'

export interface Soldier {
  id: string
  nombre: string
  rango: string | null
  ciudad_rescate: string | null
  fecha_rescate: string
  foto_oficial_url: string | null
  fotos_momento: string[]
  descripcion: string
  tags: string[]
  notas: string | null
  estado: SoldierEstado
  created_at: string
}
