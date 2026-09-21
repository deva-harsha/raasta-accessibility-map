import L from 'leaflet'

export const MAP_CENTER = [17.385, 78.4867]
export const MAP_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
}
export const MAP_ATTRIBUTION = '<a href="https://openfreemap.org/">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export const VERDICT_COLORS = {
  'Likely passable': '#0a685f',
  'Temporary obstruction': '#b66b16',
  'Not passable': '#b23a31',
  'Manual verification needed': '#6d7471',
}

export function reportMarkerIcon(verdict, selected = false) {
  const color = VERDICT_COLORS[verdict] || VERDICT_COLORS['Manual verification needed']
  return L.divIcon({
    className: 'report-marker-wrap',
    html: `<span class="report-marker${selected ? ' selected' : ''}" style="--marker-color:${color}"><i></i></span>`,
    iconSize: selected ? [36, 44] : [30, 38],
    iconAnchor: selected ? [18, 42] : [15, 36],
    popupAnchor: [0, -38],
  })
}
