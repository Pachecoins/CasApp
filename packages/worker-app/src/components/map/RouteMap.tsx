import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import './leaflet-fix'
import { CLIENT_ICON, WORKER_ICON } from './leaflet-fix'

interface RouteMapProps {
  workerLat: number
  workerLng: number
  clientLat: number
  clientLng: number
  className?: string
}

function BoundsFitter({ p1, p2 }: { p1: LatLngExpression; p2: LatLngExpression }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds([p1, p2] as [LatLngExpression, LatLngExpression], {
      padding: [60, 60],
      animate: true,
      maxZoom: 16,
    })
  }, [map, p1, p2])
  return null
}

export function RouteMap({ workerLat, workerLng, clientLat, clientLng, className }: RouteMapProps) {
  return (
    <MapContainer
      center={[workerLat, workerLng]}
      zoom={13}
      className={className ?? 'w-full h-full'}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© OpenStreetMap contributors'
      />

      {/* Worker (me) */}
      <Marker position={[workerLat, workerLng]} icon={WORKER_ICON}>
        <Popup><div className="text-sm font-medium">Tu posición</div></Popup>
      </Marker>

      {/* Client destination */}
      <Marker position={[clientLat, clientLng]} icon={CLIENT_ICON}>
        <Popup><div className="text-sm font-medium">Domicilio del cliente</div></Popup>
      </Marker>

      <BoundsFitter
        p1={[workerLat, workerLng]}
        p2={[clientLat, clientLng]}
      />
    </MapContainer>
  )
}
