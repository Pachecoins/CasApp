// Fix Leaflet default icon broken paths in Vite/webpack bundlers
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// Custom colored markers
export const createColoredIcon = (color: string, label?: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px; height: 36px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      ">
        ${label ? `<span style="transform:rotate(45deg);font-size:14px">${label}</span>` : ''}
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  })

export const CLIENT_ICON = createColoredIcon('#2D6A4F', '🏠')
export const WORKER_ICON = createColoredIcon('#E07A5F', '👷')
export const WORKER_AVAILABLE_ICON = createColoredIcon('#2D6A4F', '⭐')
