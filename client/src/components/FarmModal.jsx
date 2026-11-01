import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';

export const INDIAN_AGRI_PRESETS = [
  { label: 'Ludhiana, Punjab', state: 'Punjab', district: 'Ludhiana', lat: 30.9010, lng: 75.8573, note: 'Wheat & Paddy' },
  { label: 'Karnal, Haryana', state: 'Haryana', district: 'Karnal', lat: 29.6857, lng: 76.9905, note: 'Basmati Belt' },
  { label: 'Nashik, Maharashtra', state: 'Maharashtra', district: 'Nashik', lat: 19.9975, lng: 73.7898, note: 'Onion & Grape' },
  { label: 'Rajkot, Gujarat', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022, note: 'Groundnut & Cotton' },
  { label: 'Guntur, Andhra Pradesh', state: 'Andhra Pradesh', district: 'Guntur', lat: 16.3067, lng: 80.4365, note: 'Chili & Tobacco' },
  { label: 'Varanasi, Uttar Pradesh', state: 'Uttar Pradesh', district: 'Varanasi', lat: 25.3176, lng: 82.9739, note: 'Gangetic Plains' },
  { label: 'Mandya, Karnataka', state: 'Karnataka', district: 'Mandya', lat: 12.5218, lng: 76.8951, note: 'Sugarcane Valley' },
  { label: 'Burdwan, West Bengal', state: 'West Bengal', district: 'Purba Bardhaman', lat: 23.2324, lng: 87.8615, note: 'Rice Bowl' },
  { label: 'Thanjavur, Tamil Nadu', state: 'Tamil Nadu', district: 'Thanjavur', lat: 10.7870, lng: 79.1378, note: 'Cauvery Delta' },
  { label: 'Bhopal, Madhya Pradesh', state: 'Madhya Pradesh', district: 'Bhopal', lat: 23.2599, lng: 77.4126, note: 'Soybean & Pulses' },
  { label: 'Jaipur, Rajasthan', state: 'Rajasthan', district: 'Jaipur', lat: 26.9124, lng: 75.7873, note: 'Mustard & Millets' },
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Delhi NCR'
];

export const FARM_TYPES = [
  'Crop Farming', 'Horticulture', 'Dairy', 'Mixed Farming', 'Organic Farming', 'Plantation', 'Other'
];

export const OWNERSHIP_TYPES = [
  'Owned', 'Leased', 'Shared', 'Managed', 'Other'
];

export const AREA_UNITS = [
  'Acres', 'Hectares', 'Bigha', 'Square Metres'
];

export const SOIL_TYPES = [
  'Alluvial', 'Black (Regur)', 'Red & Yellow', 'Laterite', 'Clayey', 'Sandy Loam', 'Loamy', 'Saline', 'Peaty', 'Other'
];

export const LAND_TERRAINS = [
  'Flat / Plain', 'Undulating / Rolling', 'Hilly / Sloped', 'Terraced', 'Valley / Lowland', 'Other'
];

export const IRRIGATION_SOURCES_LIST = [
  'Tube Well / Borewell', 'Canal', 'Drip Irrigation System', 'River / Stream',
  'Rainwater Harvesting / Pond', 'Open Well', 'Sprinkler System', 'Municipal / Tanker', 'None / Rainfed', 'Other'
];

export const IRRIGATION_METHODS_LIST = [
  'Drip', 'Sprinkler', 'Flood / Furrow', 'Center Pivot', 'Manual / Traditional', 'Rainfed', 'Other'
];

export const WATER_AVAILABILITIES = [
  'Year-round (Perennial)', 'Seasonal (Monsoon)', 'Critical / Water Stressed', 'Groundwater Dependent', 'Other'
];

export const ELECTRICITY_AVAILABILITIES = [
  '24/7 Grid Power', 'Intermittent / Dedicated Farm Feeder (6-8 hrs)', 'Solar Powered', 'Diesel Generator Backup', 'No Electricity', 'Other'
];

export const STORAGE_FACILITIES_LIST = [
  'Cold Storage', 'Grain Silo / Warehouse', 'Packhouse / Sorting Shed', 'Chemical / Fertilizer Shed', 'Farm Machinery Shed', 'None'
];

export const GREENHOUSE_TYPES = [
  'None', 'Naturally Ventilated Polyhouse', 'Hi-Tech Climate Controlled Polyhouse', 'Shade Net House', 'Other'
];

export const FARM_EQUIPMENT_LIST = [
  'Tractor', 'Harvester', 'Power Tiller', 'Rotavator', 'Seed Drill', 'Sprayer Drone', 'Boom Sprayer', 'Drip Automation Unit', 'Other'
];

export const FARMING_METHODS = [
  'Conventional', 'Organic Certified', 'Natural / Zero-Budget (ZBNF)', 'Hydroponic / Aeroponic',
  'Regenerative', 'Permaculture', 'Integrated Pest Management (IPM)', 'Other'
];

export const SEASONS_LIST = [
  'Kharif (Monsoon)', 'Rabi (Winter)', 'Zaid (Summer)', 'Perennial / Multi-Season'
];

export const SOIL_FERTILITY_LEVELS = [
  'High', 'Medium', 'Low', 'Under Treatment / Restoration', 'Other'
];

export const ORGANIC_CERT_STATUSES = [
  'Not Certified', 'In Conversion (Year 1)', 'In Conversion (Year 2)', 'In Conversion (Year 3)',
  'Certified Organic (NPOP/NOP)', 'PGS-India Certified', 'Participatory Guarantee', 'Other'
];

export const FARM_STATUSES = [
  'Active', 'Fallow / Inactive', 'Under Development', 'Leased Out'
];

export const CROP_SUGGESTIONS = [
  'Wheat', 'Basmati Rice', 'Paddy', 'Cotton', 'Sugarcane', 'Soybean', 'Maize',
  'Mustard', 'Gram (Chickpea)', 'Moong Dal', 'Groundnut', 'Potato', 'Tomato',
  'Onion', 'Chili', 'Mango', 'Banana', 'Turmeric', 'Ginger', 'Tea', 'Coffee'
];

const SECTIONS = [
  { id: 'basic', label: 'Basic Info', icon: 'bi-info-circle' },
  { id: 'location', label: 'Location & GPS', icon: 'bi-geo-alt' },
  { id: 'land', label: 'Land & Area', icon: 'bi-aspect-ratio' },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'bi-droplet' },
  { id: 'agricultural', label: 'Agriculture', icon: 'bi-flower1' },
  { id: 'management', label: 'Management', icon: 'bi-person-badge' },
];

export const FarmModal = ({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialData = null,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('basic');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsStatusNotice, setGpsStatusNotice] = useState('');
  const [cropInput, setCropInput] = useState('');
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // Basic
    name: '',
    farmCode: '',
    description: '',
    farmType: 'Crop Farming',
    ownershipType: 'Owned',
    establishedYear: '',
    coverImage: '',
    // Location
    country: 'India',
    state: '',
    region: '',
    district: '',
    city: '',
    tehsil: '',
    village: '',
    address: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    // Land
    totalArea: '',
    areaUnit: 'Acres',
    cultivableArea: '',
    irrigatedArea: '',
    nonCultivableArea: '',
    soilType: 'Alluvial',
    landTerrain: 'Flat / Plain',
    // Infrastructure
    irrigationSources: [],
    irrigationMethods: [],
    waterAvailability: 'Year-round (Perennial)',
    electricityAvailability: '24/7 Grid Power',
    storageFacilities: [],
    greenhousePolyhouse: 'None',
    farmEquipment: [],
    // Agricultural
    primaryCrops: [],
    farmingMethod: 'Conventional',
    farmingSeasons: [],
    soilFertility: 'Medium',
    annualRainfallMm: '',
    organicCertStatus: 'Not Certified',
    agriculturalNotes: '',
    // Management
    managerName: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    farmStatus: 'Active',
    internalNotes: '',
  });

  // Populate data when editing or opening
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setGpsStatusNotice('');
    setCoverImageFile(null);
    setActiveTab('basic');

    if (mode === 'edit' && initialData) {
      const loc = initialData.location || {};
      const land = initialData.landDetails || {};
      const infra = initialData.infrastructure || {};
      const agri = initialData.agriculturalDetails || {};
      const mgmt = initialData.management || {};

      setFormData({
        name: initialData.name || '',
        farmCode: initialData.farmCode || '',
        description: initialData.description || '',
        farmType: initialData.farmType || 'Crop Farming',
        ownershipType: initialData.ownershipType || 'Owned',
        establishedYear: initialData.establishedYear ? String(initialData.establishedYear) : '',
        coverImage: initialData.coverImage || '',

        country: loc.country || 'India',
        state: loc.state || loc.region || '',
        region: loc.region || loc.state || '',
        district: loc.district || '',
        city: loc.city || '',
        tehsil: loc.tehsil || '',
        village: loc.village || '',
        address: loc.address || '',
        postalCode: loc.postalCode || '',
        latitude: loc.latitude !== undefined && loc.latitude !== null ? String(loc.latitude) : '',
        longitude: loc.longitude !== undefined && loc.longitude !== null ? String(loc.longitude) : '',

        totalArea: land.totalArea !== undefined && land.totalArea !== null ? String(land.totalArea) : '',
        areaUnit: land.areaUnit || 'Acres',
        cultivableArea: land.cultivableArea !== undefined && land.cultivableArea !== null ? String(land.cultivableArea) : '',
        irrigatedArea: land.irrigatedArea !== undefined && land.irrigatedArea !== null ? String(land.irrigatedArea) : '',
        nonCultivableArea: land.nonCultivableArea !== undefined && land.nonCultivableArea !== null ? String(land.nonCultivableArea) : '',
        soilType: land.soilType || 'Alluvial',
        landTerrain: land.landTerrain || 'Flat / Plain',

        irrigationSources: Array.isArray(infra.irrigationSources) ? [...infra.irrigationSources] : [],
        irrigationMethods: Array.isArray(infra.irrigationMethods) ? [...infra.irrigationMethods] : [],
        waterAvailability: infra.waterAvailability || 'Year-round (Perennial)',
        electricityAvailability: infra.electricityAvailability || '24/7 Grid Power',
        storageFacilities: Array.isArray(infra.storageFacilities) ? [...infra.storageFacilities] : [],
        greenhousePolyhouse: infra.greenhousePolyhouse || 'None',
        farmEquipment: Array.isArray(infra.farmEquipment) ? [...infra.farmEquipment] : [],

        primaryCrops: Array.isArray(agri.primaryCrops) ? [...agri.primaryCrops] : [],
        farmingMethod: agri.farmingMethod || 'Conventional',
        farmingSeasons: Array.isArray(agri.farmingSeasons) ? [...agri.farmingSeasons] : [],
        soilFertility: agri.soilFertility || 'Medium',
        annualRainfallMm: agri.annualRainfallMm !== undefined && agri.annualRainfallMm !== null ? String(agri.annualRainfallMm) : '',
        organicCertStatus: agri.organicCertStatus || 'Not Certified',
        agriculturalNotes: agri.agriculturalNotes || '',

        managerName: mgmt.managerName || '',
        contactPerson: mgmt.contactPerson || '',
        contactPhone: mgmt.contactPhone || '',
        contactEmail: mgmt.contactEmail || '',
        farmStatus: mgmt.farmStatus || 'Active',
        internalNotes: mgmt.internalNotes || '',
      });
      setCoverImagePreview(initialData.coverImage || '');
    } else {
      // Create defaults
      const autoCode = 'FRM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setFormData({
        name: '',
        farmCode: autoCode,
        description: '',
        farmType: 'Crop Farming',
        ownershipType: 'Owned',
        establishedYear: new Date().getFullYear().toString(),
        coverImage: '',

        country: 'India',
        state: 'Punjab',
        region: 'Punjab',
        district: '',
        city: '',
        tehsil: '',
        village: '',
        address: '',
        postalCode: '',
        latitude: '',
        longitude: '',

        totalArea: '',
        areaUnit: 'Acres',
        cultivableArea: '',
        irrigatedArea: '',
        nonCultivableArea: '',
        soilType: 'Alluvial',
        landTerrain: 'Flat / Plain',

        irrigationSources: ['Tube Well / Borewell'],
        irrigationMethods: ['Drip'],
        waterAvailability: 'Year-round (Perennial)',
        electricityAvailability: '24/7 Grid Power',
        storageFacilities: [],
        greenhousePolyhouse: 'None',
        farmEquipment: ['Tractor'],

        primaryCrops: ['Wheat'],
        farmingMethod: 'Conventional',
        farmingSeasons: ['Kharif (Monsoon)', 'Rabi (Winter)'],
        soilFertility: 'Medium',
        annualRainfallMm: '',
        organicCertStatus: 'Not Certified',
        agriculturalNotes: '',

        managerName: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        farmStatus: 'Active',
        internalNotes: '',
      });
      setCoverImagePreview('');
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'state') next.region = value;
      return next;
    });
  };

  const handleArrayToggle = (field, item) => {
    setFormData((prev) => {
      const current = prev[field] || [];
      const updated = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      return { ...prev, [field]: updated };
    });
  };

  const handleAddCrop = (crop) => {
    const trimmed = crop.trim();
    if (!trimmed) return;
    if (!formData.primaryCrops.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        primaryCrops: [...prev.primaryCrops, trimmed],
      }));
    }
    setCropInput('');
  };

  const handleRemoveCrop = (crop) => {
    setFormData((prev) => ({
      ...prev,
      primaryCrops: prev.primaryCrops.filter((c) => c !== crop),
    }));
  };

  // Detect GPS
  const handleDetectDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsStatusNotice('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    setGpsStatusNotice('Acquiring satellite GPS lock…');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        setDetectingGps(false);
        setGpsStatusNotice(t('farms.gpsDetected') || 'GPS coordinates detected accurately.');
      },
      (err) => {
        setDetectingGps(false);
        setGpsStatusNotice(`GPS Notice: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Apply Preset
  const handleApplyPreset = (preset) => {
    setFormData((prev) => ({
      ...prev,
      state: preset.state,
      region: preset.state,
      district: preset.district,
      city: preset.district,
      latitude: String(preset.lat),
      longitude: String(preset.lng),
    }));
    setGpsStatusNotice(`Preset applied: ${preset.label} (${preset.note})`);
  };

  // Cover Image Selection
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Selected image exceeds 10MB maximum limit.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please select an authentic JPEG, PNG, or WebP image.');
      return;
    }
    setCoverImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverImagePreview(objectUrl);
  };

  // Area consistency validation check
  const totalNum = formData.totalArea ? Number(formData.totalArea) : null;
  const cultNum = formData.cultivableArea ? Number(formData.cultivableArea) : null;
  const nonCultNum = formData.nonCultivableArea ? Number(formData.nonCultivableArea) : null;
  const irrNum = formData.irrigatedArea ? Number(formData.irrigatedArea) : null;

  let areaWarning = '';
  if (totalNum !== null && totalNum > 0) {
    if (cultNum !== null && cultNum > totalNum) {
      areaWarning = 'Cultivable area cannot exceed total farm area.';
    } else if (nonCultNum !== null && nonCultNum > totalNum) {
      areaWarning = 'Non-cultivable area cannot exceed total farm area.';
    } else if (cultNum !== null && nonCultNum !== null && cultNum + nonCultNum > totalNum * 1.001) {
      areaWarning = 'Sum of cultivable and non-cultivable area exceeds total farm area.';
    } else if (irrNum !== null) {
      const cap = cultNum !== null ? cultNum : totalNum;
      if (irrNum > cap * 1.001) {
        areaWarning = 'Irrigated area cannot exceed cultivable or total farm area.';
      }
    }
  }

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setActiveTab('basic');
      setError('Farm name is required.');
      return;
    }

    if (areaWarning) {
      setActiveTab('land');
      setError(areaWarning);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        farmCode: formData.farmCode.trim(),
        description: formData.description.trim(),
        farmType: formData.farmType,
        ownershipType: formData.ownershipType,
        coverImage: formData.coverImage.trim(),
        location: {
          country: formData.country.trim() || 'India',
          state: formData.state.trim(),
          region: formData.state.trim() || formData.region.trim(),
          district: formData.district.trim(),
          city: formData.city.trim() || formData.district.trim(),
          tehsil: formData.tehsil.trim(),
          village: formData.village.trim(),
          address: formData.address.trim(),
          postalCode: formData.postalCode.trim(),
        },
        landDetails: {
          areaUnit: formData.areaUnit,
          soilType: formData.soilType,
          landTerrain: formData.landTerrain,
        },
        infrastructure: {
          irrigationSources: formData.irrigationSources,
          irrigationMethods: formData.irrigationMethods,
          waterAvailability: formData.waterAvailability,
          electricityAvailability: formData.electricityAvailability,
          storageFacilities: formData.storageFacilities,
          greenhousePolyhouse: formData.greenhousePolyhouse,
          farmEquipment: formData.farmEquipment,
        },
        agriculturalDetails: {
          primaryCrops: formData.primaryCrops,
          farmingMethod: formData.farmingMethod,
          farmingSeasons: formData.farmingSeasons,
          soilFertility: formData.soilFertility,
          organicCertStatus: formData.organicCertStatus,
          agriculturalNotes: formData.agriculturalNotes.trim(),
        },
        management: {
          managerName: formData.managerName.trim(),
          contactPerson: formData.contactPerson.trim(),
          contactPhone: formData.contactPhone.trim(),
          contactEmail: formData.contactEmail.trim().toLowerCase(),
          farmStatus: formData.farmStatus,
          internalNotes: formData.internalNotes.trim(),
        },
      };

      if (formData.establishedYear) {
        payload.establishedYear = Number(formData.establishedYear);
      }
      if (formData.latitude !== '' && !isNaN(Number(formData.latitude))) {
        payload.location.latitude = Number(formData.latitude);
      }
      if (formData.longitude !== '' && !isNaN(Number(formData.longitude))) {
        payload.location.longitude = Number(formData.longitude);
      }
      if (formData.totalArea !== '' && !isNaN(Number(formData.totalArea))) {
        payload.landDetails.totalArea = Number(formData.totalArea);
      }
      if (formData.cultivableArea !== '' && !isNaN(Number(formData.cultivableArea))) {
        payload.landDetails.cultivableArea = Number(formData.cultivableArea);
      }
      if (formData.irrigatedArea !== '' && !isNaN(Number(formData.irrigatedArea))) {
        payload.landDetails.irrigatedArea = Number(formData.irrigatedArea);
      }
      if (formData.nonCultivableArea !== '' && !isNaN(Number(formData.nonCultivableArea))) {
        payload.landDetails.nonCultivableArea = Number(formData.nonCultivableArea);
      }
      if (formData.annualRainfallMm !== '' && !isNaN(Number(formData.annualRainfallMm))) {
        payload.agriculturalDetails.annualRainfallMm = Number(formData.annualRainfallMm);
      }

      let resFarm;
      if (mode === 'edit' && initialData) {
        const farmId = initialData._id || initialData.id;
        const res = await apiRequest(`/farms/${farmId}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
        resFarm = res.farm;

        // If an image file was selected, upload it to the cover image endpoint
        if (coverImageFile) {
          const imgData = new FormData();
          imgData.append('photo', coverImageFile);
          const imgRes = await apiRequest(`/farms/${farmId}/cover-image`, {
            method: 'POST',
            token,
            body: imgData,
          });
          if (imgRes.farm) resFarm = imgRes.farm;
        }
      } else {
        const res = await apiRequest('/farms', {
          method: 'POST',
          token,
          body: payload,
        });
        resFarm = res.farm;

        // Upload image file if selected
        if (coverImageFile && resFarm?._id) {
          const imgData = new FormData();
          imgData.append('photo', coverImageFile);
          const imgRes = await apiRequest(`/farms/${resFarm._id}/cover-image`, {
            method: 'POST',
            token,
            body: imgData,
          });
          if (imgRes.farm) resFarm = imgRes.farm;
        }
      }

      onSuccess(resFarm);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save farm profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="custom-modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 1050 }}>
      <div
        className="custom-modal-card card shadow-lg border-0 rounded-4 overflow-hidden"
        style={{
          width: '95%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fff',
        }}
      >
        {/* Modal Header */}
        <div className="d-flex align-items-center justify-content-between p-3 p-sm-4 border-bottom bg-light">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-success-subtle text-success p-2 rounded-3 fs-5">
              <i className={mode === 'edit' ? 'bi bi-pencil-square' : 'bi bi-building-add'} />
            </span>
            <div>
              <h5 className="mb-0 fw-bold text-dark">
                {mode === 'edit' ? 'Edit Farm Profile' : 'Register New Farm'}
              </h5>
              <small className="text-muted">
                {mode === 'edit'
                  ? `Updating comprehensive agricultural & management profile for ${initialData?.name || 'farm'}`
                  : 'Capture complete agricultural, geographical, land, infrastructure, and management details'}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          />
        </div>

        {/* Section Navigation Tabs */}
        <div className="border-bottom bg-white px-3 pt-2">
          <ul
            className="nav nav-pills flex-nowrap overflow-x-auto pb-2 gap-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {SECTIONS.map((sec) => (
              <li key={sec.id} className="nav-item flex-shrink-0">
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1-5 fw-semibold d-flex align-items-center gap-1-5 ${
                    activeTab === sec.id
                      ? 'btn-success text-white shadow-sm'
                      : 'btn-outline-light text-dark border-0 hover-bg-light'
                  }`}
                  onClick={() => setActiveTab(sec.id)}
                >
                  <i className={`bi ${sec.icon}`} />
                  <span>{sec.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Modal Body - Scrollable Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="p-3 p-sm-4 overflow-y-auto" style={{ flex: 1 }}>
            {error && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-5" />
                <div>{error}</div>
              </div>
            )}

            {areaWarning && (
              <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3" role="alert">
                <i className="bi bi-exclamation-circle-fill fs-5" />
                <div>{areaWarning}</div>
              </div>
            )}

            {/* TAB 1: BASIC INFORMATION */}
            {activeTab === 'basic' && (
              <div className="row g-3">
                <div className="col-12 col-md-8">
                  <label className="form-label fw-semibold small text-dark">
                    Farm / Estate Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Green Valley Agricultural Complex"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">
                    Farm ID / Code <span className="badge bg-secondary-subtle text-secondary ms-1">Auto</span>
                  </label>
                  <input
                    type="text"
                    className="form-control bg-light font-monospace"
                    value={formData.farmCode}
                    onChange={(e) => handleChange('farmCode', e.target.value.toUpperCase())}
                    placeholder="FRM-XXXXXX"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Farm Type</label>
                  <select
                    className="form-select"
                    value={formData.farmType}
                    onChange={(e) => handleChange('farmType', e.target.value)}
                  >
                    {FARM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label fw-semibold small text-dark">Ownership Type</label>
                  <select
                    className="form-select"
                    value={formData.ownershipType}
                    onChange={(e) => handleChange('ownershipType', e.target.value)}
                  >
                    {OWNERSHIP_TYPES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label fw-semibold small text-dark">Established Year</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 2018"
                    min="1800"
                    max="2100"
                    value={formData.establishedYear}
                    onChange={(e) => handleChange('establishedYear', e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Farm Description</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Brief description of the farm, major produce, topography, soil health or operational goals..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    maxLength={2000}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Farm Cover Image</label>
                  <div className="d-flex flex-column flex-sm-row gap-3 align-items-sm-center">
                    {coverImagePreview && (
                      <div className="position-relative" style={{ width: '120px', height: '80px' }}>
                        <img
                          src={coverImagePreview}
                          alt="Farm Cover Preview"
                          className="w-100 h-100 object-fit-cover rounded-3 border"
                        />
                      </div>
                    )}
                    <div className="flex-grow-1">
                      <input
                        type="file"
                        className="form-control mb-2"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageFileChange}
                      />
                      <input
                        type="url"
                        className="form-control form-control-sm"
                        placeholder="Or enter direct image URL (e.g. https://...)"
                        value={formData.coverImage}
                        onChange={(e) => {
                          handleChange('coverImage', e.target.value);
                          setCoverImagePreview(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GEOGRAPHICAL INFORMATION */}
            {activeTab === 'location' && (
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">Country</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">State / Region</label>
                  <select
                    className="form-select"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                  >
                    <option value="">Select State...</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">District</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ludhiana / Nashik"
                    value={formData.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">Tehsil / Taluka</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Jagraon"
                    value={formData.tehsil}
                    onChange={(e) => handleChange('tehsil', e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">Village / Town</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Kothe Sherpur"
                    value={formData.village}
                    onChange={(e) => handleChange('village', e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">Postal / PIN Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 142026"
                    value={formData.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Full Address / Landmark</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Complete farm road address or plot survey numbers..."
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                  />
                </div>

                {/* GPS Coordinates & Presets */}
                <div className="col-12">
                  <div className="p-3 bg-light rounded-3 border">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <span className="fw-semibold small text-dark">
                        <i className="bi bi-geo-alt-fill text-success me-1" />
                        Geographical Coordinates (For Live Weather & Field Mapping)
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                        onClick={handleDetectDeviceGps}
                        disabled={detectingGps}
                      >
                        <i className={`bi bi-crosshair ${detectingGps ? 'spin-animation' : ''}`} />
                        {detectingGps ? 'Acquiring GPS…' : 'Detect Device GPS'}
                      </button>
                    </div>

                    <div className="row g-2">
                      <div className="col-6">
                        <input
                          type="number"
                          step="0.0001"
                          className="form-control form-control-sm"
                          placeholder="Latitude (-90 to 90)"
                          value={formData.latitude}
                          onChange={(e) => handleChange('latitude', e.target.value)}
                        />
                      </div>
                      <div className="col-6">
                        <input
                          type="number"
                          step="0.0001"
                          className="form-control form-control-sm"
                          placeholder="Longitude (-180 to 180)"
                          value={formData.longitude}
                          onChange={(e) => handleChange('longitude', e.target.value)}
                        />
                      </div>
                    </div>

                    {gpsStatusNotice && (
                      <div className="small text-success mt-2 d-flex align-items-center gap-1">
                        <i className="bi bi-check-circle-fill" /> {gpsStatusNotice}
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-top">
                      <small className="text-muted d-block mb-1">Quick Agricultural Hub Presets:</small>
                      <div className="d-flex flex-wrap gap-1">
                        {INDIAN_AGRI_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            className="btn btn-white btn-sm border py-0-5 px-2 rounded-2 small text-dark"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => handleApplyPreset(p)}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LAND AND AREA INFORMATION */}
            {activeTab === 'land' && (
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Total Farm Area</label>
                  <div className="input-group">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-control"
                      placeholder="e.g. 25.5"
                      value={formData.totalArea}
                      onChange={(e) => handleChange('totalArea', e.target.value)}
                    />
                    <select
                      className="form-select"
                      style={{ maxWidth: '140px' }}
                      value={formData.areaUnit}
                      onChange={(e) => handleChange('areaUnit', e.target.value)}
                    >
                      {AREA_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Cultivable Area</label>
                  <div className="input-group">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-control"
                      placeholder="Area suitable for crop sowing"
                      value={formData.cultivableArea}
                      onChange={(e) => handleChange('cultivableArea', e.target.value)}
                    />
                    <span className="input-group-text small">{formData.areaUnit}</span>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Irrigated Area</label>
                  <div className="input-group">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-control"
                      placeholder="Area covered by irrigation network"
                      value={formData.irrigatedArea}
                      onChange={(e) => handleChange('irrigatedArea', e.target.value)}
                    />
                    <span className="input-group-text small">{formData.areaUnit}</span>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Non-Cultivable Area</label>
                  <div className="input-group">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-control"
                      placeholder="Roads, sheds, water bodies, rocky terrain"
                      value={formData.nonCultivableArea}
                      onChange={(e) => handleChange('nonCultivableArea', e.target.value)}
                    />
                    <span className="input-group-text small">{formData.areaUnit}</span>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Primary Soil Type</label>
                  <select
                    className="form-select"
                    value={formData.soilType}
                    onChange={(e) => handleChange('soilType', e.target.value)}
                  >
                    {SOIL_TYPES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Land Terrain</label>
                  <select
                    className="form-select"
                    value={formData.landTerrain}
                    onChange={(e) => handleChange('landTerrain', e.target.value)}
                  >
                    {LAND_TERRAINS.map((lt) => (
                      <option key={lt} value={lt}>{lt}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TAB 4: INFRASTRUCTURE & IRRIGATION */}
            {activeTab === 'infrastructure' && (
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Irrigation Sources (Select all that apply)</label>
                  <div className="d-flex flex-wrap gap-2">
                    {IRRIGATION_SOURCES_LIST.map((source) => {
                      const selected = formData.irrigationSources.includes(source);
                      return (
                        <button
                          key={source}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${
                            selected ? 'btn-success text-white' : 'btn-outline-secondary'
                          }`}
                          onClick={() => handleArrayToggle('irrigationSources', source)}
                        >
                          <i className={`bi ${selected ? 'bi-check2' : 'bi-plus'} me-1`} />
                          {source}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Irrigation Methods</label>
                  <div className="d-flex flex-wrap gap-2">
                    {IRRIGATION_METHODS_LIST.map((method) => {
                      const selected = formData.irrigationMethods.includes(method);
                      return (
                        <button
                          key={method}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${
                            selected ? 'btn-primary text-white' : 'btn-outline-secondary'
                          }`}
                          onClick={() => handleArrayToggle('irrigationMethods', method)}
                        >
                          <i className={`bi ${selected ? 'bi-check2' : 'bi-plus'} me-1`} />
                          {method}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Water Availability</label>
                  <select
                    className="form-select"
                    value={formData.waterAvailability}
                    onChange={(e) => handleChange('waterAvailability', e.target.value)}
                  >
                    {WATER_AVAILABILITIES.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Electricity Availability</label>
                  <select
                    className="form-select"
                    value={formData.electricityAvailability}
                    onChange={(e) => handleChange('electricityAvailability', e.target.value)}
                  >
                    {ELECTRICITY_AVAILABILITIES.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Greenhouse / Polyhouse</label>
                  <select
                    className="form-select"
                    value={formData.greenhousePolyhouse}
                    onChange={(e) => handleChange('greenhousePolyhouse', e.target.value)}
                  >
                    {GREENHOUSE_TYPES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Storage Facilities</label>
                  <div className="d-flex flex-wrap gap-2">
                    {STORAGE_FACILITIES_LIST.map((fac) => {
                      const selected = formData.storageFacilities.includes(fac);
                      return (
                        <button
                          key={fac}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${
                            selected ? 'btn-secondary text-white' : 'btn-outline-secondary'
                          }`}
                          onClick={() => handleArrayToggle('storageFacilities', fac)}
                        >
                          <i className={`bi ${selected ? 'bi-check2' : 'bi-plus'} me-1`} />
                          {fac}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Farm Equipment & Machinery</label>
                  <div className="d-flex flex-wrap gap-2">
                    {FARM_EQUIPMENT_LIST.map((eq) => {
                      const selected = formData.farmEquipment.includes(eq);
                      return (
                        <button
                          key={eq}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${
                            selected ? 'btn-dark text-white' : 'btn-outline-secondary'
                          }`}
                          onClick={() => handleArrayToggle('farmEquipment', eq)}
                        >
                          <i className={`bi ${selected ? 'bi-check2' : 'bi-plus'} me-1`} />
                          {eq}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: AGRICULTURAL INFORMATION */}
            {activeTab === 'agricultural' && (
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Primary Crops Cultivated</label>
                  <div className="d-flex gap-2 mb-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Add crop name and press Add (e.g. Wheat, Basmati Rice, Mustard)"
                      value={cropInput}
                      onChange={(e) => setCropInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCrop(cropInput);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm px-3 flex-shrink-0"
                      onClick={() => handleAddCrop(cropInput)}
                    >
                      Add Crop
                    </button>
                  </div>

                  <div className="d-flex flex-wrap gap-1 mb-2">
                    {formData.primaryCrops.map((c) => (
                      <span key={c} className="badge bg-success-subtle text-success p-2 rounded-pill d-flex align-items-center gap-1">
                        <i className="bi bi-sprout" /> {c}
                        <button
                          type="button"
                          className="btn-close btn-close-white ms-1"
                          style={{ fontSize: '0.6rem' }}
                          onClick={() => handleRemoveCrop(c)}
                        />
                      </span>
                    ))}
                  </div>

                  <small className="text-muted d-block">Quick suggestions:</small>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {CROP_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="btn btn-white btn-sm border py-0-5 px-2 rounded-2 small text-secondary"
                        style={{ fontSize: '0.72rem' }}
                        onClick={() => handleAddCrop(s)}
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Farming Method</label>
                  <select
                    className="form-select"
                    value={formData.farmingMethod}
                    onChange={(e) => handleChange('farmingMethod', e.target.value)}
                  >
                    {FARMING_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Organic Certification Status</label>
                  <select
                    className="form-select"
                    value={formData.organicCertStatus}
                    onChange={(e) => handleChange('organicCertStatus', e.target.value)}
                  >
                    {ORGANIC_CERT_STATUSES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Soil Fertility Level</label>
                  <select
                    className="form-select"
                    value={formData.soilFertility}
                    onChange={(e) => handleChange('soilFertility', e.target.value)}
                  >
                    {SOIL_FERTILITY_LEVELS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Typical Annual Rainfall (mm)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 750"
                    value={formData.annualRainfallMm}
                    onChange={(e) => handleChange('annualRainfallMm', e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Farming Seasons</label>
                  <div className="d-flex flex-wrap gap-2">
                    {SEASONS_LIST.map((season) => {
                      const selected = formData.farmingSeasons.includes(season);
                      return (
                        <button
                          key={season}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${
                            selected ? 'btn-success text-white' : 'btn-outline-secondary'
                          }`}
                          onClick={() => handleArrayToggle('farmingSeasons', season)}
                        >
                          <i className={`bi ${selected ? 'bi-check2' : 'bi-plus'} me-1`} />
                          {season}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Additional Agricultural Notes</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Crop rotation plans, pest management observations, fertilizer schedules..."
                    value={formData.agriculturalNotes}
                    onChange={(e) => handleChange('agriculturalNotes', e.target.value)}
                    maxLength={2000}
                  />
                </div>
              </div>
            )}

            {/* TAB 6: FARM MANAGEMENT */}
            {activeTab === 'management' && (
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Farm Status</label>
                  <select
                    className="form-select"
                    value={formData.farmStatus}
                    onChange={(e) => handleChange('farmStatus', e.target.value)}
                  >
                    {FARM_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small text-dark">Farm Manager Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Gurpreet Singh"
                    value={formData.managerName}
                    onChange={(e) => handleChange('managerName', e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">Contact Person</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Primary on-site supervisor"
                    value={formData.contactPerson}
                    onChange={(e) => handleChange('contactPerson', e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">Contact Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="+91 98765 43210"
                    value={formData.contactPhone}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    maxLength={30}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small text-dark">Contact Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="manager@farm.com"
                    value={formData.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    maxLength={120}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-dark">Internal Operational Notes</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Internal management notes, lease agreements, power meter numbers, emergency contacts..."
                    value={formData.internalNotes}
                    onChange={(e) => handleChange('internalNotes', e.target.value)}
                    maxLength={2000}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sticky Modal Footer */}
          <div className="p-3 border-top bg-light d-flex align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-1">
              {SECTIONS.findIndex((s) => s.id === activeTab) > 0 && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    const idx = SECTIONS.findIndex((s) => s.id === activeTab);
                    if (idx > 0) setActiveTab(SECTIONS[idx - 1].id);
                  }}
                  disabled={submitting}
                >
                  <i className="bi bi-chevron-left me-1" />
                  Previous
                </button>
              )}
              {SECTIONS.findIndex((s) => s.id === activeTab) < SECTIONS.length - 1 && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    const idx = SECTIONS.findIndex((s) => s.id === activeTab);
                    if (idx < SECTIONS.length - 1) setActiveTab(SECTIONS[idx + 1].id);
                  }}
                  disabled={submitting}
                >
                  Next
                  <i className="bi bi-chevron-right ms-1" />
                </button>
              )}
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary px-3"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success px-4 fw-semibold shadow-sm d-flex align-items-center gap-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                    Saving Farm…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle fs-5" />
                    {mode === 'edit' ? 'Save Changes' : 'Complete Registration'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FarmModal;
