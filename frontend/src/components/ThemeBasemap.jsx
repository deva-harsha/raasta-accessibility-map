import { useEffect } from 'react'
import { TileLayer, useMap } from 'react-leaflet'
import { MAP_TILES } from '../mapConfig'

export default function ThemeBasemap({ theme }) {
  const map = useMap()
  const tiles = MAP_TILES[theme] || MAP_TILES.light

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize())
    const followUp = window.setTimeout(() => map.invalidateSize(), 180)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(followUp)
    }
  }, [map, theme])

  return (
    <TileLayer
      key={theme}
      url={tiles.url}
      attribution={tiles.attribution}
      subdomains={tiles.subdomains}
      maxZoom={tiles.maxZoom}
    />
  )
}
