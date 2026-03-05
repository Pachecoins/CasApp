import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import './leaflet-fix'
import { CLIENT_ICON, WORKER_ICON, WORKER_AVAILABLE_ICON } from './leaflet-fix'

interface WorkerPin {
  id: string
  lat: number
  lng: number
  name: string
  distanceKm?: number
  estimatedArrivalMin?: number
  isTracked?: boolean // true = this is the assigned worker being tracked
}

interface TrackingMapProps {
  clientLat: number
  clientLng: number
  workers?: WorkerPin[]
  zoom?: number
  className?: string
}

// Smooth-pan map to new center
function MapPanner({ center }: { center: LatLngExpression }) {
  const map = useMap()
  useEffect(() => {
    map.panTo(center, { animate: true, duration: 0.8 })
  }, [map, center])
  return null
}

// Auto-fit bounds to show both client and worker
function BoundsFitter({ clientLat, clientLng, workerLat, workerLng }: {
  clientLat: number; clientLng: number; workerLat?: number; workerLng?: number
}) {
  const map = useMap()
  useEffect(() => {
    if (workerLat !== undefined && workerLng !== undefined) {
      map.fitBounds(
        [[clientLat, clientLng], [workerLat, workerLng]],
        { padding: [60, 60], animate: true, maxZoom: 16 },
      )
    }
  }, [map, clientLat, clientLng, workerLat, workerLng])
  return null
}

export function TrackingMap({ clientLat, clientLng, workers = [], zoom = 14, className }: TrackingMapProps) {
  const trackedWorker = workers.find((w) => w.isTracked)

  return (
    <MapContainer
      center={[clientLat, clientLng]}
      zoom={zoom}
      className={className ?? 'w-full h-full'}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Client marker */}
      <Marker position={[clientLat, clientLng]} icon={CLIENT_ICON}>
        <Popup>
          <div className="text-sm font-medium">Tu domicilio</div>
        </Popup>
      </Marker>

      {/* Worker markers */}
      {workers.map((worker) => (
        <Marker
          key={worker.id}
          position={[worker.lat, worker.lng]}
          icon={worker.isTracked ? WORKER_ICON : WORKER_AVAILABLE_ICON}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{worker.name}</p>
              {worker.distanceKm !== undefined && (
                <p className="text-gray-500">{worker.distanceKm} km • ~{worker.estimatedArrivalMin} min</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Auto-fit when tracked worker exists */}
      {trackedWorker && (
        <BoundsFitter
          clientLat={clientLat}
          clientLng={clientLng}
          workerLat={trackedWorker.lat}
          workerLng={trackedWorker.lng}
        />
      )}
    </MapContainer>
  )
}
