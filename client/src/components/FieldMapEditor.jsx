import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawRenderMode,
} from 'terra-draw';
import { TerraDrawLeafletAdapter } from 'terra-draw-leaflet-adapter';
import { useLanguage } from '../context/useLanguage.js';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculatePolygonBoundingBox,
  LEGAL_DISCLAIMER_TEXT,
  validateGeoJSONPolygon,
} from '../lib/geoUtils.js';

// Fix Leaflet's default icon URLs for Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Satellite and Basemap Tile Layers
const BASEMAP_TILES = {
  esriSatellite: {
    id: 'esriSatellite',
    name: 'Satellite (Esri Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
  },
  hybridLabels: {
    id: 'hybridLabels',
    name: 'Satellite + Labels (Hybrid)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 19,
  },
  osmStreet: {
    id: 'osmStreet',
    name: 'Street Map (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

const DEFAULT_CENTER = [30.9010, 75.8573]; // Punjab Agri Belt default
const DEFAULT_ZOOM = 14;

export const FieldMapEditor = ({
  initialBoundary = null,
  initialCenter = null,
  initialZoom = DEFAULT_ZOOM,
  onBoundaryChange = () => {},
  readOnly = false,
  height = 'clamp(360px, 60vh, 580px)',
  activeFieldName = '',
}) => {
  const { t } = useLanguage();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseTileLayerRef = useRef(null);
  const overlayTileLayerRef = useRef(null);
  const terraDrawRef = useRef(null);
  const gpsMarkerRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState('esriSatellite');
  const [currentMode, setCurrentMode] = useState('static'); // 'static' | 'polygon' | 'select'
  const [metrics, setMetrics] = useState({
    hectares: 0,
    acres: 0,
    squareMeters: 0,
    perimeterMeters: 0,
    vertexCount: 0,
  });
  const [drawnBoundary, setDrawnBoundary] = useState(initialBoundary);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [gpsLocating, setGpsLocating] = useState(false);

  // Initialize Leaflet Map and Terra Draw
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const center = initialCenter || (initialBoundary?.coordinates?.[0]?.[0]
      ? [initialBoundary.coordinates[0][0][1], initialBoundary.coordinates[0][0][0]]
      : DEFAULT_CENTER);

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: initialZoom,
      zoomControl: false, // We render modern custom zoom buttons
      attributionControl: true,
    });

    // Base Tile Layer (Esri Satellite)
    const baseLayer = L.tileLayer(BASEMAP_TILES.esriSatellite.url, {
      maxZoom: BASEMAP_TILES.esriSatellite.maxZoom,
      attribution: BASEMAP_TILES.esriSatellite.attribution,
    }).addTo(map);

    baseTileLayerRef.current = baseLayer;
    mapInstanceRef.current = map;

    // Terra Draw initialization with Leaflet adapter
    const adapter = new TerraDrawLeafletAdapter({
      lib: L,
      map,
    });

    const draw = new TerraDraw({
      adapter,
      modes: [
        new TerraDrawPolygonMode({
          snapping: true,
          allowSelfIntersection: false,
          styles: {
            polygonFillColor: '#10b981',
            polygonFillOpacity: 0.35,
            polygonOutlineColor: '#059669',
            polygonOutlineWidth: 3,
            closingPointColor: '#047857',
            closingPointWidth: 4,
          },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: !readOnly,
                rotateable: false,
                scaleable: false,
                coordinates: {
                  midpoints: !readOnly,
                  draggable: !readOnly,
                  deletable: !readOnly,
                },
              },
            },
          },
          styles: {
            selectedPolygonFillColor: '#34d399',
            selectedPolygonFillOpacity: 0.45,
            selectedPolygonOutlineColor: '#10b981',
            selectedPolygonOutlineWidth: 3.5,
            selectionPointColor: '#ffffff',
            selectionPointOutlineColor: '#059669',
            selectionPointWidth: 4,
            midPointColor: '#a7f3d0',
            midPointOutlineColor: '#059669',
            midPointWidth: 3,
          },
        }),
        new TerraDrawRenderMode({
          modeName: 'render',
          styles: {
            polygonFillColor: '#22c55e',
            polygonFillOpacity: 0.3,
            polygonOutlineColor: '#16a34a',
            polygonOutlineWidth: 2.5,
          },
        }),
      ],
    });

    draw.start();
    terraDrawRef.current = draw;

    // Load initial boundary if available
    if (initialBoundary?.type === 'Polygon' && initialBoundary.coordinates) {
      try {
        const feature = {
          type: 'Feature',
          geometry: initialBoundary,
          properties: { mode: 'polygon' },
        };
        draw.addFeatures([feature]);

        // Calculate and set initial metrics
        const areaMetrics = calculatePolygonArea(initialBoundary.coordinates);
        const perimMetrics = calculatePolygonPerimeter(initialBoundary.coordinates);
        const ring = initialBoundary.coordinates[0] || [];
        setMetrics({
          hectares: areaMetrics.hectares,
          acres: areaMetrics.acres,
          squareMeters: areaMetrics.squareMeters,
          perimeterMeters: perimMetrics.meters,
          vertexCount: Math.max(0, ring.length - 1),
        });

        // Fit map bounds to existing polygon
        const bbox = calculatePolygonBoundingBox(initialBoundary.coordinates);
        if (bbox) {
          map.fitBounds(bbox, { padding: [40, 40], maxZoom: 17 });
        }
      } catch (err) {
        console.error('Failed to load initial field polygon into Terra Draw:', err);
      }
    }

    // Handle Terra Draw Finish event (new polygon completed)
    draw.on('finish', (id) => {
      const snapshot = draw.getSnapshot();
      const polygonFeature = snapshot.find((f) => f.geometry.type === 'Polygon');
      if (polygonFeature) {
        const coords = polygonFeature.geometry.coordinates;
        const areaMetrics = calculatePolygonArea(coords);
        const perimMetrics = calculatePolygonPerimeter(coords);
        const ring = coords[0] || [];

        const updatedMetrics = {
          hectares: areaMetrics.hectares,
          acres: areaMetrics.acres,
          squareMeters: areaMetrics.squareMeters,
          perimeterMeters: perimMetrics.meters,
          vertexCount: Math.max(0, ring.length - 1),
        };
        setMetrics(updatedMetrics);

        const newGeoJSON = {
          type: 'Polygon',
          coordinates: coords,
        };
        setDrawnBoundary(newGeoJSON);
        onBoundaryChange(newGeoJSON, updatedMetrics);
      }
      // Automatically switch to select mode so user can immediately edit vertices
      draw.setMode('select');
      setCurrentMode('select');
    });

    // Handle Terra Draw Change event (polygon vertices dragged/edited)
    draw.on('change', () => {
      const snapshot = draw.getSnapshot();
      const polygonFeature = snapshot.find((f) => f.geometry.type === 'Polygon');
      if (polygonFeature) {
        const coords = polygonFeature.geometry.coordinates;
        const areaMetrics = calculatePolygonArea(coords);
        const perimMetrics = calculatePolygonPerimeter(coords);
        const ring = coords[0] || [];

        const updatedMetrics = {
          hectares: areaMetrics.hectares,
          acres: areaMetrics.acres,
          squareMeters: areaMetrics.squareMeters,
          perimeterMeters: perimMetrics.meters,
          vertexCount: Math.max(0, ring.length - 1),
        };
        setMetrics(updatedMetrics);

        const newGeoJSON = {
          type: 'Polygon',
          coordinates: coords,
        };
        setDrawnBoundary(newGeoJSON);
        onBoundaryChange(newGeoJSON, updatedMetrics);
      }
    });

    return () => {
      try {
        draw.stop();
      } catch {}
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map layer switch
  const handleSwitchLayer = (layerKey) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }
    if (overlayTileLayerRef.current) {
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    const config = BASEMAP_TILES[layerKey];
    if (!config) return;

    const newBase = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      attribution: config.attribution,
    }).addTo(map);

    baseTileLayerRef.current = newBase;

    // If hybrid, add labels overlay
    if (config.overlayUrl) {
      const overlay = L.tileLayer(config.overlayUrl, {
        maxZoom: config.maxZoom,
      }).addTo(map);
      overlayTileLayerRef.current = overlay;
    }

    setActiveLayer(layerKey);
  };

  // Change Terra Draw Mode (Polygon, Select, or Explore)
  const handleSetMode = (modeName) => {
    const draw = terraDrawRef.current;
    if (!draw || readOnly) return;

    if (modeName === 'polygon') {
      // Clear existing feature before drawing new boundary to enforce single field boundary
      draw.clear();
      setMetrics({ hectares: 0, acres: 0, squareMeters: 0, perimeterMeters: 0, vertexCount: 0 });
      setDrawnBoundary(null);
      onBoundaryChange(null, null);
      draw.setMode('polygon');
      setCurrentMode('polygon');
    } else if (modeName === 'select') {
      draw.setMode('select');
      setCurrentMode('select');
    } else {
      draw.setMode('render');
      setCurrentMode('static');
    }
  };

  // Clear Drawn Boundary
  const handleClear = () => {
    const draw = terraDrawRef.current;
    if (!draw || readOnly) return;
    draw.clear();
    setMetrics({ hectares: 0, acres: 0, squareMeters: 0, perimeterMeters: 0, vertexCount: 0 });
    setDrawnBoundary(null);
    onBoundaryChange(null, null);
    draw.setMode('render');
    setCurrentMode('static');
  };

  // Zoom Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  // Reset View to Polygon or Default
  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (drawnBoundary?.coordinates) {
      const bbox = calculatePolygonBoundingBox(drawnBoundary.coordinates);
      if (bbox) {
        map.fitBounds(bbox, { padding: [40, 40], maxZoom: 17 });
        return;
      }
    }
    map.setView(initialCenter || DEFAULT_CENTER, initialZoom);
  };

  // Device GPS Location Detection
  const handleDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Device geolocation is not supported in this browser.');
      return;
    }

    setGpsLocating(true);
    setGpsStatus('Acquiring satellite GPS lock…');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const map = mapInstanceRef.current;
        if (!map) return;

        map.flyTo([latitude, longitude], 17, { duration: 1.5 });

        // Add or update GPS marker
        if (gpsMarkerRef.current) {
          gpsMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          const marker = L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: '#3b82f6',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }).addTo(map);

          marker.bindPopup(
            `<strong>Your Device GPS Location</strong><br/>Accuracy: ~${Math.round(accuracy)}m`
          ).openPopup();

          gpsMarkerRef.current = marker;
        }

        setGpsLocating(false);
        setGpsStatus(`GPS Position Located (~${Math.round(accuracy)}m accuracy)`);
        setTimeout(() => setGpsStatus(''), 4000);
      },
      (err) => {
        setGpsLocating(false);
        setGpsStatus(`GPS acquisition error: ${err.message}`);
        setTimeout(() => setGpsStatus(''), 5000);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Location Search (City, district, coordinates)
  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    setSearchError('');

    // Check if query is latitude, longitude directly (e.g. "30.9010, 75.8573")
    const coordMatch = searchQuery.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        mapInstanceRef.current?.flyTo([lat, lng], 16, { duration: 1.5 });
        setSearching(false);
        return;
      }
    }

    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=1`;
      const res = await fetch(endpoint, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        mapInstanceRef.current?.flyTo([lat, lon], 15, { duration: 1.5 });
      } else {
        setSearchError('Location not found. Try entering city, district, or coordinates (lat, lng).');
      }
    } catch {
      setSearchError('Search failed. Please check network connection.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="card shadow-sm border-0 rounded-4 overflow-hidden position-relative">
      {/* Top Map Toolbar: Basemap switcher, Search, GPS, Drawing actions */}
      <div className="bg-dark text-white p-2 p-md-3 d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom border-secondary border-opacity-50">
        {/* Left: Mode Selection Toolbar */}
        <div className="d-flex align-items-center flex-wrap gap-1">
          <div className="btn-group btn-group-sm" role="group" aria-label={t('mapping.drawingTools')}>
            <button
              type="button"
              className={`btn ${currentMode === 'polygon' ? 'btn-success fw-bold' : 'btn-outline-light'}`}
              onClick={() => handleSetMode('polygon')}
              disabled={readOnly}
              title={t('mapping.drawingHint')}
            >
              <i className="bi bi-pencil-fill me-1" />
              <span className="d-none d-sm-inline">{drawnBoundary ? t('mapping.redrawPolygon') : t('mapping.drawBoundary')}</span>
              <span className="d-inline d-sm-none">{drawnBoundary ? 'Redraw' : 'Draw'}</span>
            </button>
            <button
              type="button"
              className={`btn ${currentMode === 'select' ? 'btn-warning text-dark fw-bold' : 'btn-outline-light'}`}
              onClick={() => handleSetMode('select')}
              disabled={readOnly || !drawnBoundary}
              title={t('mapping.editHint')}
            >
              <i className="bi bi-cursor-fill me-1" />
              <span className="d-none d-sm-inline">{t('mapping.editVertices')}</span>
              <span className="d-inline d-sm-none">Edit</span>
            </button>
            <button
              type="button"
              className={`btn ${currentMode === 'static' ? 'btn-secondary fw-semibold' : 'btn-outline-light'}`}
              onClick={() => handleSetMode('static')}
              title={t('mapping.panHint')}
            >
              <i className="bi bi-hand-index-thumb me-1" />
              <span className="d-none d-sm-inline">{t('mapping.panMap')}</span>
              <span className="d-inline d-sm-none">Pan</span>
            </button>
          </div>

          {drawnBoundary && !readOnly && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm ms-1"
              onClick={handleClear}
              title={t('mapping.deleteBoundaryHint')}
            >
              <i className="bi bi-trash3 me-1" />
              <span className="d-none d-sm-inline">{t('common.clear') || 'Clear'}</span>
            </button>
          )}
        </div>

        {/* Right: Location Search & Basemap Switcher */}
        <div className="d-flex align-items-center flex-wrap gap-2">
          {/* Quick Search Bar */}
          <form onSubmit={handleSearchLocation} className="d-flex align-items-center flex-grow-1 flex-sm-grow-0">
            <div className="input-group input-group-sm" style={{ minWidth: '140px', maxWidth: '240px', width: '100%' }}>
              <input
                type="text"
                className="form-control form-control-sm bg-dark text-white border-secondary"
                placeholder={t('mapping.searchPlaceholder') || 'Search village/coords…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-outline-light"
                disabled={searching || !searchQuery.trim()}
                title={t('common.search')}
              >
                {searching ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                ) : (
                  <i className="bi bi-search" />
                )}
              </button>
            </div>
          </form>

          {/* GPS Button */}
          <button
            type="button"
            className="btn btn-outline-info btn-sm d-flex align-items-center gap-1"
            onClick={handleDeviceGps}
            disabled={gpsLocating}
            title={t('farms.useDeviceGps')}
          >
            <i className={`bi bi-geo-alt-fill ${gpsLocating ? 'spin-animation' : ''}`} />
            <span className="d-none d-md-inline">{gpsLocating ? t('mapping.locating') : t('farms.useDeviceGps')}</span>
          </button>

          {/* Basemap Switcher Dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-outline-light btn-sm dropdown-toggle d-flex align-items-center gap-1"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="bi bi-layers-fill" />
              <span className="d-none d-sm-inline">
                {activeLayer === 'esriSatellite' ? t('mapping.satellite') : activeLayer === 'hybridLabels' ? t('mapping.hybrid') : t('mapping.street')}
              </span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow">
              <li>
                <button
                  type="button"
                  className={`dropdown-item small ${activeLayer === 'esriSatellite' ? 'active fw-bold' : ''}`}
                  onClick={() => handleSwitchLayer('esriSatellite')}
                >
                  <i className="bi bi-globe-americas me-2" />
                  {t('mapping.satellite')} (Esri World Imagery)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`dropdown-item small ${activeLayer === 'hybridLabels' ? 'active fw-bold' : ''}`}
                  onClick={() => handleSwitchLayer('hybridLabels')}
                >
                  <i className="bi bi-map me-2" />
                  {t('mapping.hybrid')} (Satellite + Place Labels)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`dropdown-item small ${activeLayer === 'osmStreet' ? 'active fw-bold' : ''}`}
                  onClick={() => handleSwitchLayer('osmStreet')}
                >
                  <i className="bi bi-signpost-2 me-2" />
                  {t('mapping.street')} (OpenStreetMap)
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Floating Notices / Warnings */}
      {searchError && (
        <div className="alert alert-warning py-1 px-3 m-2 small d-flex align-items-center justify-content-between">
          <span>{searchError}</span>
          <button type="button" className="btn-close btn-close-sm" onClick={() => setSearchError('')} />
        </div>
      )}

      {gpsStatus && (
        <div className="alert alert-info py-1 px-3 m-2 small d-flex align-items-center gap-2">
          <i className="bi bi-geo-alt flex-shrink-0" />
          <span>{gpsStatus}</span>
        </div>
      )}

      {/* Map Canvas Container */}
      <div className="position-relative" style={{ height, width: '100%', minHeight: '400px' }}>
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />

        {/* Custom Map Floating Controls (Zoom & Reset) */}
        <div
          className="position-absolute end-0 top-0 m-3 d-flex flex-column gap-2"
          style={{ zIndex: 1000 }}
        >
          <div className="btn-group-vertical shadow-sm">
            <button
              type="button"
              className="btn btn-light btn-sm fw-bold border"
              onClick={handleZoomIn}
              title="Zoom In"
              style={{ width: '36px', height: '36px' }}
            >
              <i className="bi bi-plus-lg" />
            </button>
            <button
              type="button"
              className="btn btn-light btn-sm fw-bold border"
              onClick={handleZoomOut}
              title="Zoom Out"
              style={{ width: '36px', height: '36px' }}
            >
              <i className="bi bi-dash-lg" />
            </button>
          </div>
          <button
            type="button"
            className="btn btn-light btn-sm shadow-sm border"
            onClick={handleResetView}
            title="Fit to Field / Reset View"
            style={{ width: '36px', height: '36px' }}
          >
            <i className="bi bi-arrows-fullscreen" />
          </button>
        </div>

        {/* Top-Left Status Badge: Legal disclaimer / User-Defined Label */}
        <div
          className="position-absolute start-0 top-0 m-2 m-sm-3 d-flex flex-column gap-1"
          style={{ zIndex: 1000, maxWidth: 'calc(100% - 64px)' }}
        >
          <div className="badge bg-dark bg-opacity-75 text-white border border-light border-opacity-25 px-2 py-1-5 text-start shadow-sm d-flex align-items-center gap-2">
            <span className="live-pulse-dot" style={{ backgroundColor: '#10b981' }} />
            <div>
              <span className="fw-bold d-block text-truncate" style={{ fontSize: '0.78rem' }}>
                {activeFieldName || 'Field Boundary Polygon'}
              </span>
              <span className="text-warning small" style={{ fontSize: '0.72rem' }}>
                User-Defined &bull; Approximate Estimate
              </span>
            </div>
          </div>
        </div>

        {/* Drawing Hint Badge */}
        {currentMode === 'polygon' && (
          <div
            className="position-absolute bottom-0 start-50 translate-middle-x mb-3 mb-sm-4 px-3 py-1-5 bg-dark text-white rounded-pill shadow-lg small border border-success d-flex align-items-center gap-2"
            style={{ zIndex: 1000, fontSize: '0.8rem', maxWidth: 'calc(100% - 1.5rem)', textAlign: 'center' }}
          >
            <span className="spinner-grow spinner-grow-sm text-success flex-shrink-0" role="status" aria-hidden="true" />
            <span className="text-truncate-2">{t('mapping.drawingHint')}</span>
          </div>
        )}
      </div>

      {/* Bottom Metrics & Legal Disclaimer Bar */}
      <div className="card-footer bg-white border-top p-3">
        <div className="row g-3 align-items-center">
          {/* Live Calculated Area & Perimeter */}
          <div className="col-12 col-md-7">
            <div className="d-flex flex-wrap align-items-center gap-3">
              <div>
                <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>{t('mapping.approxArea')}</span>
                <span className="h5 fw-bold text-success mb-0">
                  {metrics.hectares > 0 ? `${metrics.hectares} ha` : '—'}
                </span>
                {metrics.acres > 0 && (
                  <span className="text-secondary small ms-1">({metrics.acres} acres)</span>
                )}
              </div>
              <div className="border-start ps-3">
                <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>{t('mapping.perimeter')}</span>
                <span className="fw-semibold text-dark mb-0">
                  {metrics.perimeterMeters > 0 ? `${metrics.perimeterMeters} m` : '—'}
                </span>
              </div>
              <div className="border-start ps-3">
                <span className="text-muted d-block small" style={{ fontSize: '0.75rem' }}>{t('mapping.boundaryPoints')}</span>
                <span className="fw-semibold text-dark mb-0">
                  {metrics.vertexCount > 0 ? `${metrics.vertexCount} vertices` : '0 points'}
                </span>
              </div>
            </div>
          </div>

          {/* Legally Cautious Notice Callout */}
          <div className="col-12 col-md-5">
            <div className="d-flex align-items-start gap-2 p-2 bg-light rounded-3 border">
              <i className="bi bi-shield-exclamation text-warning flex-shrink-0 mt-1" />
              <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: '1.25' }}>
                <strong>{t('mapping.legalNotice')}:</strong> {t('mapping.legalNoticeText') || LEGAL_DISCLAIMER_TEXT}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldMapEditor;
