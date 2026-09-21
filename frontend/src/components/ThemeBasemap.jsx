import maplibreGL from '@maplibre/maplibre-gl-leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { MAP_ATTRIBUTION, MAP_STYLES } from '../mapConfig'

export default function ThemeBasemap({ theme }) {
  const map = useMap()

  useEffect(() => {
    const layer = maplibreGL({
      style: MAP_STYLES[theme],
      attributionControl: false,
      interactive: false,
    })
    layer.addTo(map)
    map.attributionControl.addAttribution(MAP_ATTRIBUTION)
    return () => {
      map.removeLayer(layer)
      map.attributionControl.removeAttribution(MAP_ATTRIBUTION)
    }
  }, [map, theme])

  return null
}
