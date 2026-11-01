import { useEffect, useState, useMemo } from 'react';
import { FarmModal } from '../components/FarmModal.jsx';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';
import { Badge, Card, EmptyState, ErrorState, FormField, LoadingState, PageHeader } from '../components/ui.jsx';
import { AuthenticatedImage } from '../components/AuthenticatedImage.jsx';


const FARM_DETAIL_TABS = [
  { id: 'overview', label: 'Overview', icon: 'bi-grid-1x2' },
  { id: 'location', label: 'Location', icon: 'bi-geo-alt' },
  { id: 'land', label: 'Land & Soil', icon: 'bi-aspect-ratio' },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'bi-droplet' },
  { id: 'agricultural', label: 'Agriculture', icon: 'bi-flower1' },
  { id: 'fields', label: 'Fields & Plots', icon: 'bi-grid-3x3-gap' },
  { id: 'images', label: 'Images & Photos', icon: 'bi-images' },
  { id: 'management', label: 'Management', icon: 'bi-person-badge' },
  { id: 'history', label: 'Activity History', icon: 'bi-clock-history' },
];

const emptyField = { name: '', areaHectares: '', soilType: '', waterSource: '', irrigationDetails: '' };
const createEmptyPlanting = () => ({
  cropName: '',
  variety: '',
  season: '',
  plantingDate: new Date().toISOString().split('T')[0],
  expectedHarvestDate: '',
  stage: 'sowing',
  notes: '',
});

const createEmptyActivity = (fieldId = '', activeCycleId = '') => ({
  type: 'irrigation',
  date: new Date().toISOString().split('T')[0],
  cropCycleId: activeCycleId || '',
  fieldId: fieldId || '',
  notes: '',
  performedBy: '',
  cost: '',
  inputs: [],
});

const createEmptyTask = (fieldId = '', activeCycleId = '') => ({
  title: '',
  type: 'general',
  dueDate: new Date().toISOString().split('T')[0],
  priority: 'medium',
  status: 'pending',
  notes: '',
  assignee: '',
  fieldId: fieldId || '',
  cropCycleId: activeCycleId || '',
});

const STAGES = [
  { id: 'sowing', label: 'Sowing', tone: 'sowing', icon: 'bi-seedling' },
  { id: 'germination', label: 'Germination', tone: 'sowing', icon: 'bi-flower1' },
  { id: 'vegetative', label: 'Vegetative', tone: 'vegetative', icon: 'bi-tree' },
  { id: 'flowering', label: 'Flowering', tone: 'flowering', icon: 'bi-flower2' },
  { id: 'fruiting', label: 'Fruiting', tone: 'ripening', icon: 'bi-apple' },
  { id: 'ripening', label: 'Ripening', tone: 'ripening', icon: 'bi-sun' },
  { id: 'harvested', label: 'Harvested', tone: 'harvested', icon: 'bi-basket2' },
];

const ACTIVITY_TYPES = [
  { id: 'irrigation', label: 'Irrigation', icon: 'bi-droplet-fill', className: 'activity-node-irrigation' },
  { id: 'fertilizer', label: 'Fertilizer application', icon: 'bi-capsule', className: 'activity-node-fertilizer' },
  { id: 'treatment', label: 'Treatment / Spraying', icon: 'bi-shield-check', className: 'activity-node-treatment' },
  { id: 'pest_observation', label: 'Pest observation', icon: 'bi-bug', className: 'activity-node-pest_observation' },
  { id: 'inspection', label: 'Field inspection', icon: 'bi-clipboard-check', className: 'activity-node-inspection' },
  { id: 'labor', label: 'Labor / Weeding', icon: 'bi-people', className: 'activity-node-labor' },
  { id: 'planting', label: 'Planting event', icon: 'bi-sprout', className: 'activity-node-planting' },
  { id: 'harvesting', label: 'Harvesting event', icon: 'bi-basket2-fill', className: 'activity-node-harvesting' },
];

const TASK_TYPES = [
  { id: 'general', label: 'General task' },
  { id: 'irrigation', label: 'Irrigation' },
  { id: 'fertilizer', label: 'Fertilizer' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'pest_observation', label: 'Pest observation' },
  { id: 'inspection', label: 'Inspection' },
  { id: 'labor', label: 'Labor' },
  { id: 'planting', label: 'Planting' },
  { id: 'harvesting', label: 'Harvesting' },
];

const TASK_PRIORITIES = [
  { id: 'low', label: 'Low priority' },
  { id: 'medium', label: 'Medium priority' },
  { id: 'high', label: 'High priority' },
  { id: 'urgent', label: 'Urgent' },
];

const TASK_TYPE_ICONS = {
  planting: 'bi-sprout',
  irrigation: 'bi-droplet-half',
  fertilizer: 'bi-capsule',
  pest_observation: 'bi-bug',
  treatment: 'bi-shield-plus',
  inspection: 'bi-search',
  labor: 'bi-people',
  harvesting: 'bi-basket2',
  general: 'bi-check2-square',
};

const FarmDetailPage = () => {
  const { farmId } = useParams();
  const { token } = useAuth();
  const { t } = useLanguage();
  const [farm, setFarm] = useState(null);
  const [currentMainTab, setCurrentMainTab] = useState('overview');
  const [farmEditModalOpen, setFarmEditModalOpen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadNotice, setCoverUploadNotice] = useState('');

  const [fields, setFields] = useState([]);
  const [cropCycles, setCropCycles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyField);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyField);
  const [retryCount, setRetryCount] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  // Field subtabs: { [fieldId]: 'cycles' | 'activities' | 'tasks' | 'photos' }
  const [fieldSubtabs, setFieldSubtabs] = useState({});

  // Crop cycle interactions
  const [plantingFieldId, setPlantingFieldId] = useState(null);
  const [plantForm, setPlantForm] = useState(createEmptyPlanting);
  const [cycleSaving, setCycleSaving] = useState(false);
  const [completingCycleId, setCompletingCycleId] = useState(null);
  const [harvestDate, setHarvestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [harvestYield, setHarvestYield] = useState('');
  const [harvestYieldUnit, setHarvestYieldUnit] = useState('kg');
  const [expandedHistory, setExpandedHistory] = useState({});

  // Phase 2: Activity logging
  const [activityFieldId, setActivityFieldId] = useState(null);
  const [activityForm, setActivityForm] = useState(() => createEmptyActivity());
  const [activitySaving, setActivitySaving] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState(null);

  // Phase 2: Tasks planning
  const [taskFieldId, setTaskFieldId] = useState(null);
  const [taskForm, setTaskForm] = useState(() => createEmptyTask());
  const [taskSaving, setTaskSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState(() => createEmptyTask());
  const [taskFilterState, setTaskFilterState] = useState({}); // { [fieldId]: 'all' | 'pending' | 'completed' }

  // Phase 3: Secure Field Photographs & Visual History
  const [photoFieldId, setPhotoFieldId] = useState(null);
  const [photoForm, setPhotoForm] = useState(() => ({
    file: null,
    capturedAt: '',
    cropCycleId: '',
    notes: '',
  }));
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [photoViewMode, setPhotoViewMode] = useState({}); // { [fieldId]: 'gallery' | 'timeline' }

  const [now] = useState(() => Date.now());
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    let active = true;
    const loadFarmData = async () => {
      setLoading(true);
      setError('');
      try {
        const [farmData, fieldData, cycleData, activityData, taskData, photoData] = await Promise.all([
          apiRequest(`/farms/${farmId}`, { token }),
          apiRequest(`/farms/${farmId}/fields`, { token }),
          apiRequest(`/farms/crop-cycles?farmId=${farmId}`, { token }),
          apiRequest(`/farms/activities?farmId=${farmId}`, { token }),
          apiRequest(`/farms/tasks?farmId=${farmId}`, { token }),
          apiRequest(`/farms/photos?farmId=${farmId}`, { token }),
        ]);
        if (active) {
          setFarm(farmData.farm);
          setFields(fieldData.fields);
          setCropCycles(cycleData.cropCycles || []);
          setActivities(activityData.activities || []);
          setTasks(taskData.tasks || []);
          setPhotos(photoData.photos || []);
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadFarmData();
    return () => {
      active = false;
    };
  }, [farmId, token, retryCount]);

  const submitField = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        areaHectares: Number(form.areaHectares),
        ...(form.soilType.trim() ? { soilType: form.soilType.trim() } : {}),
        ...(form.waterSource.trim() ? { waterSource: form.waterSource.trim() } : {}),
        ...(form.irrigationDetails?.trim() ? { irrigationDetails: form.irrigationDetails.trim() } : {}),
      };
      const data = await apiRequest(`/farms/${farmId}/fields`, {
        method: 'POST',
        token,
        body: payload,
      });
      setFields((current) => [data.field, ...current]);
      setForm(emptyField);
      setNotice('Field added successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveField = async (fieldId) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await apiRequest(`/farms/fields/${fieldId}`, {
        method: 'PATCH',
        token,
        body: {
          name: editForm.name.trim(),
          areaHectares: Number(editForm.areaHectares),
          soilType: editForm.soilType.trim(),
          waterSource: editForm.waterSource.trim(),
        },
      });
      setFields((current) => current.map((f) => (f._id === fieldId ? data.field : f)));
      setEditingId(null);
      setNotice('Field details updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (field) => {
    if (!window.confirm(`Delete field “${field.name}”? All associated crop cycles, activities, and tasks will also be removed.`)) {
      return;
    }
    setDeletingId(field._id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/farms/fields/${field._id}`, {
        method: 'DELETE',
        token,
      });
      setFields((current) => current.filter((f) => f._id !== field._id));
      setCropCycles((current) => current.filter((c) => c.fieldId !== field._id));
      setActivities((current) => current.filter((a) => a.fieldId !== field._id));
      setTasks((current) => current.filter((t) => t.fieldId !== field._id));
      setPhotos((current) => current.filter((p) => String(p.fieldId) !== String(field._id)));
      setNotice('Field removed successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Crop cycle actions
  const handlePlantCrop = async (fieldId, event) => {
    event.preventDefault();
    setCycleSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        cropName: plantForm.cropName.trim(),
        ...(plantForm.variety.trim() ? { variety: plantForm.variety.trim() } : {}),
        ...(plantForm.season.trim() ? { season: plantForm.season.trim() } : {}),
        plantingDate: plantForm.plantingDate,
        ...(plantForm.expectedHarvestDate ? { expectedHarvestDate: plantForm.expectedHarvestDate } : {}),
        stage: plantForm.stage || 'sowing',
        status: 'active',
        ...(plantForm.notes.trim() ? { notes: plantForm.notes.trim() } : {}),
      };
      const data = await apiRequest(`/farms/${farmId}/fields/${fieldId}/crop-cycles`, {
        method: 'POST',
        token,
        body: payload,
      });
      setCropCycles((current) => [data.cropCycle, ...current]);
      setPlantingFieldId(null);
      setPlantForm(createEmptyPlanting());
      setNotice(`Crop cycle started for ${data.cropCycle.cropName}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCycleSaving(false);
    }
  };

  const handleUpdateStage = async (cycle, newStage) => {
    if (cycle.stage === newStage) return;
    setCycleSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await apiRequest(`/farms/crop-cycles/${cycle._id}`, {
        method: 'PATCH',
        token,
        body: { stage: newStage },
      });
      setCropCycles((current) =>
        current.map((c) => (c._id === cycle._id ? data.cropCycle : c))
      );
      setNotice(`Growth stage updated to ${newStage}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCycleSaving(false);
    }
  };

  const handleCompleteCycle = async (cycle, event) => {
    event.preventDefault();
    setCycleSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        status: 'completed',
        stage: 'harvested',
        harvestDate,
        ...(harvestYield && Number(harvestYield) > 0
          ? { yieldQuantity: Number(harvestYield), yieldUnit: harvestYieldUnit }
          : {}),
      };
      const data = await apiRequest(`/farms/crop-cycles/${cycle._id}`, {
        method: 'PATCH',
        token,
        body: payload,
      });
      setCropCycles((current) =>
        current.map((c) => (c._id === cycle._id ? data.cropCycle : c))
      );
      setCompletingCycleId(null);
      setHarvestYield('');
      setNotice(`Harvest recorded for ${cycle.cropName}${harvestYield ? ` (${harvestYield} ${harvestYieldUnit})` : ''}. Cycle marked as completed.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCycleSaving(false);
    }
  };

  const handleDeleteCycle = async (cycle) => {
    if (!window.confirm(`Delete crop cycle for “${cycle.cropName}”?`)) return;
    setCycleSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/farms/crop-cycles/${cycle._id}`, {
        method: 'DELETE',
        token,
      });
      setCropCycles((current) => current.filter((c) => c._id !== cycle._id));
      setNotice('Crop cycle deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCycleSaving(false);
    }
  };

  // Activity actions
  const openActivityForm = (fieldId, activeCycleId) => {
    setActivityFieldId(fieldId);
    setActivityForm(createEmptyActivity(fieldId, activeCycleId));
  };

  const addActivityInputRow = () => {
    setActivityForm((prev) => ({
      ...prev,
      inputs: [...prev.inputs, { name: '', quantity: '', unit: 'kg' }],
    }));
  };

  const updateActivityInputRow = (index, field, value) => {
    setActivityForm((prev) => {
      const updated = [...prev.inputs];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, inputs: updated };
    });
  };

  const removeActivityInputRow = (index) => {
    setActivityForm((prev) => ({
      ...prev,
      inputs: prev.inputs.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmitActivity = async (fieldId, event) => {
    event.preventDefault();
    setActivitySaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        type: activityForm.type,
        date: activityForm.date,
        ...(activityForm.cropCycleId ? { cropCycleId: activityForm.cropCycleId } : {}),
        ...(activityForm.performedBy?.trim() ? { performedBy: activityForm.performedBy.trim() } : {}),
        ...(activityForm.cost !== '' ? { cost: Number(activityForm.cost) } : {}),
        ...(activityForm.notes?.trim() ? { notes: activityForm.notes.trim() } : {}),
        inputs: activityForm.inputs
          .filter((i) => i.name?.trim())
          .map((i) => ({
            name: i.name.trim(),
            quantity: Number(i.quantity) || 0,
            unit: i.unit?.trim() || '',
          })),
      };

      const data = await apiRequest(`/farms/${farmId}/fields/${fieldId}/activities`, {
        method: 'POST',
        token,
        body: payload,
      });
      setActivities((current) => [data.activity, ...current]);
      setActivityFieldId(null);
      setNotice(`Recorded ${activityForm.type} activity.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActivitySaving(false);
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!window.confirm('Delete this recorded activity?')) return;
    setDeletingActivityId(activityId);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/farms/activities/${activityId}`, {
        method: 'DELETE',
        token,
      });
      setActivities((current) => current.filter((a) => a._id !== activityId));
      setNotice('Activity record deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingActivityId(null);
    }
  };

  // Task actions
  const openTaskForm = (fieldId, activeCycleId) => {
    setTaskFieldId(fieldId);
    setTaskForm(createEmptyTask(fieldId, activeCycleId));
  };

  const handleSubmitTask = async (fieldId, event) => {
    event.preventDefault();
    setTaskSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        title: taskForm.title.trim(),
        type: taskForm.type,
        dueDate: taskForm.dueDate,
        priority: taskForm.priority,
        status: taskForm.status || 'pending',
        farmId,
        ...(fieldId ? { fieldId } : {}),
        ...(taskForm.cropCycleId ? { cropCycleId: taskForm.cropCycleId } : {}),
        ...(taskForm.assignee?.trim() ? { assignee: taskForm.assignee.trim() } : {}),
        ...(taskForm.notes?.trim() ? { notes: taskForm.notes.trim() } : {}),
      };
      const data = await apiRequest('/farms/tasks', {
        method: 'POST',
        token,
        body: payload,
      });
      setTasks((current) => [...current, data.task]);
      setTaskFieldId(null);
      setNotice(`Task “${data.task.title}” scheduled.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTaskSaving(false);
    }
  };

  const handleToggleTask = async (task) => {
    setError('');
    setNotice('');
    try {
      const willComplete = task.status !== 'completed';
      const updated = willComplete
        ? await apiRequest(`/farms/tasks/${task._id}/complete`, {
            method: 'POST',
            token,
          })
        : await apiRequest(`/farms/tasks/${task._id}`, {
            method: 'PATCH',
            token,
            body: { status: 'pending' },
          });
      setTasks((current) =>
        current.map((t) => (t._id === task._id ? updated.task : t))
      );
      setNotice(
        willComplete
          ? `Task “${task.title}” completed. (Scheduled tasks remain distinct from logged field activities).`
          : `Task “${task.title}” marked as pending.`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveEditTask = async (taskId, event) => {
    event.preventDefault();
    setTaskSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        title: editTaskForm.title.trim(),
        type: editTaskForm.type,
        dueDate: editTaskForm.dueDate,
        priority: editTaskForm.priority,
        status: editTaskForm.status,
        assignee: editTaskForm.assignee?.trim() || '',
        notes: editTaskForm.notes?.trim() || '',
      };
      const data = await apiRequest(`/farms/tasks/${taskId}`, {
        method: 'PATCH',
        token,
        body: payload,
      });
      setTasks((current) => current.map((t) => (t._id === taskId ? data.task : t)));
      setEditingTaskId(null);
      setNotice('Task details updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTaskSaving(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this scheduled task?')) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/farms/tasks/${taskId}`, {
        method: 'DELETE',
        token,
      });
      setTasks((current) => current.filter((t) => t._id !== taskId));
      setNotice('Task deleted.');
    } catch (err) {
      setError(err.message);
    }
  };

  const getDaysInGround = (plantingDate) => {
    if (!plantingDate) return null;
    const diff = Math.floor((now - new Date(plantingDate).getTime()) / 86400000);
    return Math.max(0, diff);
  };

  const toggleHistory = (fieldId) => {
    setExpandedHistory((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const openPhotoUpload = (fieldId, activeCycleId = '') => {
    setPhotoFieldId(fieldId);
    setPhotoError('');
    setPhotoForm({
      file: null,
      capturedAt: todayDate,
      cropCycleId: activeCycleId || '',
      notes: '',
    });
  };

  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    setPhotoError('');
    if (!file) {
      setPhotoForm((prev) => ({ ...prev, file: null }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Selected image exceeds the 10MB maximum file size limit.');
      return;
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      setPhotoError('Unsupported format. Please select an authentic JPEG, PNG, or WebP photo.');
      return;
    }

    setPhotoForm((prev) => ({ ...prev, file }));
  };

  const handlePhotoUploadSubmit = async (fieldId, e) => {
    e.preventDefault();
    if (!photoForm.file) {
      setPhotoError('Please select a photograph file to upload.');
      return;
    }

    setPhotoSaving(true);
    setPhotoError('');
    setError('');
    setNotice('');

    try {
      const formData = new FormData();
      formData.append('photo', photoForm.file);
      if (photoForm.capturedAt) formData.append('capturedAt', photoForm.capturedAt);
      if (photoForm.cropCycleId) formData.append('cropCycleId', photoForm.cropCycleId);
      if (photoForm.notes) formData.append('notes', photoForm.notes.trim());

      const data = await apiRequest(`/farms/${farmId}/fields/${fieldId}/photos`, {
        method: 'POST',
        token,
        body: formData,
      });

      setPhotos((current) => [data.photo, ...current]);
      setPhotoFieldId(null);
      setNotice('Field photograph uploaded and stored securely.');
    } catch (err) {
      setPhotoError(err.message || 'Failed to upload field photograph.');
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!photoId) return;
    if (!window.confirm('Delete this field photograph? This cannot be undone.')) {
      return;
    }

    setDeletingPhotoId(photoId);
    setError('');
    setNotice('');

    try {
      await apiRequest(`/farms/photos/${photoId}`, {
        method: 'DELETE',
        token,
      });

      setPhotos((current) =>
        current.filter(
          (p) =>
            p._id !== photoId &&
            p.id !== photoId &&
            String(p._id) !== String(photoId) &&
            String(p.id) !== String(photoId)
        )
      );
      if (
        previewPhoto &&
        (previewPhoto._id === photoId ||
          previewPhoto.id === photoId ||
          String(previewPhoto._id) === String(photoId) ||
          String(previewPhoto.id) === String(photoId))
      ) {
        setPreviewPhoto(null);
      }
      setNotice('Field photograph deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete field photograph.');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  
  const totalAreaHa = fields.reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);
  const totalAcresFromFields = (totalAreaHa * 2.47105).toFixed(1);
  const displayedTotalArea = farm?.landDetails?.totalArea
    ? `${farm.landDetails.totalArea} ${farm.landDetails.areaUnit || 'Acres'}`
    : (totalAreaHa > 0 ? `${totalAreaHa.toFixed(1)} ha (~${totalAcresFromFields} ac)` : 'Not specified');
  const displayedCultivable = farm?.landDetails?.cultivableArea
    ? `${farm.landDetails.cultivableArea} ${farm.landDetails.areaUnit || 'Acres'}`
    : (totalAreaHa > 0 ? `${totalAreaHa.toFixed(1)} ha` : 'Not specified');
  const displayedIrrigated = farm?.landDetails?.irrigatedArea
    ? `${farm.landDetails.irrigatedArea} ${farm.landDetails.areaUnit || 'Acres'}`
    : 'Not configured';
  const activeCycles = cropCycles.filter((c) => c.status === 'active');

  const cropDistribution = useMemo(() => {
    const map = {};
    for (const cycle of activeCycles) {
      const name = cycle.cropName || 'Unnamed Crop';
      if (!map[name]) {
        map[name] = { count: 0, fields: new Set(), varieties: new Set() };
      }
      map[name].count += 1;
      if (cycle.fieldId) map[name].fields.add(cycle.fieldId);
      if (cycle.variety) map[name].varieties.add(cycle.variety);
    }
    return Object.entries(map).map(([name, data]) => ({
      name,
      plotCount: data.fields.size,
      activePlantings: data.count,
      varieties: Array.from(data.varieties),
    }));
  }, [activeCycles]);

  const combinedHistory = useMemo(() => {
    const list = [];
    for (const act of activities) {
      list.push({
        id: act._id,
        kind: 'activity',
        date: act.date || act.createdAt,
        title: act.type?.replace('_', ' ')?.toUpperCase() || 'ACTIVITY',
        subtitle: act.notes || 'Field activity recorded',
        field: fields.find((f) => f._id === act.fieldId)?.name || 'General Plot',
        badge: act.type,
        cost: act.cost,
        performedBy: act.performedBy,
      });
    }
    for (const t of tasks) {
      list.push({
        id: t._id,
        kind: 'task',
        date: t.completedAt || t.dueDate || t.createdAt,
        title: `TASK: ${t.title}`,
        subtitle: t.notes || (t.status === 'completed' ? 'Task completed' : 'Task scheduled'),
        field: fields.find((f) => f._id === t.fieldId)?.name || 'General',
        badge: t.status,
        assignee: t.assignee,
      });
    }
    for (const c of cropCycles) {
      if (c.plantingDate) {
        list.push({
          id: `${c._id}-plant`,
          kind: 'planting',
          date: c.plantingDate,
          title: `PLANTED: ${c.cropName} (${c.variety || 'Standard'})`,
          subtitle: `Stage: ${c.stage} • Season: ${c.season || 'Current'}`,
          field: fields.find((f) => f._id === c.fieldId)?.name || 'Plot',
          badge: 'sowing',
        });
      }
      if (c.harvestDate) {
        list.push({
          id: `${c._id}-harvest`,
          kind: 'harvest',
          date: c.harvestDate,
          title: `HARVESTED: ${c.cropName}`,
          subtitle: `Harvest completed${c.notes ? ` • ${c.notes}` : ''}`,
          field: fields.find((f) => f._id === c.fieldId)?.name || 'Plot',
          badge: 'harvested',
        });
      }
    }
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [activities, tasks, cropCycles, fields]);

  const handleCoverImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setCoverUploadNotice('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await apiRequest(`/farms/${farmId}/cover-image`, {
        method: 'POST',
        token,
        body: formData,
      });
      if (res.farm) setFarm(res.farm);
      setCoverUploadNotice('Cover image updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to upload cover image.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRemoveCoverImage = async () => {
    if (!window.confirm('Remove cover image for this farm?')) return;
    setUploadingCover(true);
    try {
      const res = await apiRequest(`/farms/${farmId}/cover-image`, {
        method: 'DELETE',
        token,
      });
      if (res.farm) setFarm(res.farm);
      setNotice('Cover image removed.');
    } catch (err) {
      setError(err.message || 'Failed to remove cover image.');
    } finally {
      setUploadingCover(false);
    }
  };

  const setSubtab = (fieldId, tab) => {
    setFieldSubtabs((prev) => ({ ...prev, [fieldId]: tab }));
  };

  if (loading) {
    return (
      <section className="page-shell">
        <LoadingState>{t('farms.loadingFarmAndFields')}</LoadingState>
      </section>
    );
  }

  if (error && !farm) {
    return (
      <section className="page-shell">
        <Link to="/farms" className="back-link">
          <i className="bi bi-arrow-left me-2" aria-hidden="true" />
          {t('farms.allFarms')}
        </Link>
        <div className="mt-3">
          <ErrorState
            message={error}
            onRetry={() => {
              setLoading(true);
              setRetryCount((count) => count + 1);
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <Link to="/farms" className="back-link">
        <i className="bi bi-arrow-left me-2" aria-hidden="true" />
        {t('nav.farms')}
      </Link>
      <PageHeader
        eyebrow={farm?.farmCode ? `${farm.farmCode} • ${farm.farmType || 'Crop Farming'}` : t('farms.eyebrow')}
        title={farm?.name}
        description={[farm?.location?.village, farm?.location?.tehsil, farm?.location?.district, farm?.location?.state || farm?.location?.region, farm?.location?.country].filter(Boolean).join(', ') || 'Location not specified'}
        actions={
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-success fw-semibold shadow-sm d-flex align-items-center gap-2"
              onClick={() => setFarmEditModalOpen(true)}
            >
              <i className="bi bi-pencil-square" aria-hidden="true" />
              <span>Edit Farm Profile</span>
            </button>
            <Link className="btn btn-outline-secondary d-flex align-items-center gap-1" to="/farms">
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />
              <span>{t('nav.farms')}</span>
            </Link>
          </div>
        }
      />

      {/* Farm Detail Navigation Tabs */}
      <div className="card shadow-sm border-0 rounded-4 p-2 mb-4 bg-white">
        <ul
          className="nav nav-pills gap-1 flex-nowrap overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {FARM_DETAIL_TABS.map((tab) => (
            <li key={tab.id} className="nav-item flex-shrink-0">
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1-5 fw-semibold d-flex align-items-center gap-1-5 ${
                  currentMainTab === tab.id
                    ? 'btn-success text-white shadow-sm'
                    : 'btn-outline-light text-dark border-0 hover-bg-light'
                }`}
                onClick={() => setCurrentMainTab(tab.id)}
              >
                <i className={`bi ${tab.icon}`} />
                <span>{tab.label}</span>
                {tab.id === 'fields' && <span className="badge bg-light text-dark border ms-1">{fields.length}</span>}
                {tab.id === 'images' && photos.length > 0 && <span className="badge bg-light text-dark border ms-1">{photos.length}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      
      {/* TAB 1: OVERVIEW */}
      {currentMainTab === 'overview' && (
        <div className="d-flex flex-column gap-4">
          {/* Top KPI Cards */}
          <div className="row g-3">
            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100">
                <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Total Area</span>
                <div className="h4 fw-bold text-dark mb-0">{displayedTotalArea}</div>
                <small className="text-success mt-1 d-block">{farm?.landDetails?.landTerrain || 'Flat / Plain'}</small>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100">
                <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Total Fields</span>
                <div className="h4 fw-bold text-dark mb-0">{fields.length}</div>
                <small className="text-muted mt-1 d-block">Configured Plots</small>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100">
                <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Cultivated</span>
                <div className="h4 fw-bold text-primary mb-0">{displayedCultivable}</div>
                <small className="text-muted mt-1 d-block">Sown / Arable</small>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100">
                <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Irrigated</span>
                <div className="h4 fw-bold text-info mb-0">{displayedIrrigated}</div>
                <small className="text-muted mt-1 d-block">{farm?.infrastructure?.waterAvailability || 'Perennial'}</small>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100">
                <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Active Crops</span>
                <div className="h4 fw-bold text-success mb-0">{activeCycles.length}</div>
                <small className="text-muted mt-1 d-block">Cycles In Ground</small>
              </div>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100">
                <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Farm Status</span>
                <div className="h5 fw-bold text-dark mb-0">
                  <span className={`badge rounded-pill px-2-5 py-1 ${
                    farm?.management?.farmStatus === 'Fallow / Inactive' ? 'bg-secondary-subtle text-secondary' : 'bg-success-subtle text-success'
                  }`}>
                    {farm?.management?.farmStatus || 'Active'}
                  </span>
                </div>
                <small className="text-muted mt-1 d-block">Operational</small>
              </div>
            </div>
          </div>

          {/* Cover Image & Estate Hero Banner */}
          {farm?.coverImage && (
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden position-relative" style={{ maxHeight: '280px' }}>
              <img
                src={farm.coverImage}
                alt={farm.name}
                className="w-100 h-100 object-fit-cover"
                style={{ maxHeight: '280px' }}
              />
              <div
                className="position-absolute bottom-0 start-0 end-0 p-3 p-sm-4 text-white"
                style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)' }}
              >
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span className="badge bg-success font-monospace">{farm.farmCode || 'ESTATE'}</span>
                  <span className="badge bg-light text-dark">{farm.farmType || 'Crop Farming'}</span>
                  <span className="badge bg-light text-dark">{farm.ownershipType || 'Owned'}</span>
                  {farm.establishedYear && (
                    <span className="badge bg-dark">Est. {farm.establishedYear}</span>
                  )}
                </div>
                <h3 className="fw-bold mb-0 text-white">{farm.name}</h3>
              </div>
            </div>
          )}

          {/* Overview Two Column Layout */}
          <div className="row g-4">
            {/* Left Column: Description & Crop Distribution */}
            <div className="col-12 col-lg-7">
              {/* Description Card */}
              <div className="card shadow-sm border-0 rounded-4 p-4 bg-white mb-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-card-text text-success" />
                    Farm Overview & Description
                  </h5>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm"
                    onClick={() => setFarmEditModalOpen(true)}
                  >
                    <i className="bi bi-pencil me-1" /> Edit
                  </button>
                </div>
                <p className="text-secondary mb-3" style={{ lineHeight: 1.7 }}>
                  {farm?.description || 'No detailed description provided for this agricultural estate. Click Edit Farm Profile to add details about topography, history, or seasonal operations.'}
                </p>

                <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                  <span className="badge bg-light text-dark border px-2-5 py-1-5 rounded-pill">
                    <i className="bi bi-layers text-primary me-1" /> Soil: <strong>{farm?.landDetails?.soilType || 'Alluvial'}</strong>
                  </span>
                  <span className="badge bg-light text-dark border px-2-5 py-1-5 rounded-pill">
                    <i className="bi bi-droplet-half text-info me-1" /> Water: <strong>{farm?.infrastructure?.waterAvailability || 'Year-round'}</strong>
                  </span>
                  <span className="badge bg-light text-dark border px-2-5 py-1-5 rounded-pill">
                    <i className="bi bi-lightning-charge text-warning me-1" /> Power: <strong>{farm?.infrastructure?.electricityAvailability || '24/7 Grid'}</strong>
                  </span>
                  <span className="badge bg-light text-dark border px-2-5 py-1-5 rounded-pill">
                    <i className="bi bi-patch-check text-success me-1" /> Cert: <strong>{farm?.agriculturalDetails?.organicCertStatus || 'Not Certified'}</strong>
                  </span>
                </div>
              </div>

              {/* Crop Distribution Card */}
              <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-pie-chart-fill text-primary" />
                    Crop Distribution & Active Plantings
                  </h5>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setCurrentMainTab('fields')}
                  >
                    Manage Crops <i className="bi bi-arrow-right ms-1" />
                  </button>
                </div>

                {cropDistribution.length > 0 ? (
                  <div className="d-flex flex-column gap-3">
                    {cropDistribution.map((crop) => (
                      <div key={crop.name} className="p-3 bg-light rounded-3 border">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <strong className="text-dark fs-6 d-flex align-items-center gap-2">
                            <i className="bi bi-sprout text-success" /> {crop.name}
                          </strong>
                          <span className="badge bg-success text-white">
                            {crop.activePlantings} active {crop.activePlantings === 1 ? 'planting' : 'plantings'}
                          </span>
                        </div>
                        <div className="small text-muted d-flex flex-wrap gap-2">
                          <span>Across {crop.plotCount} {crop.plotCount === 1 ? 'plot' : 'plots'}</span>
                          {crop.varieties.length > 0 && (
                            <span>• Varieties: {crop.varieties.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center bg-light rounded-3 border">
                    <i className="bi bi-flower1 fs-2 text-muted d-block mb-2" />
                    <p className="text-muted small mb-2">No active crop plantings recorded on this farm yet.</p>
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm"
                      onClick={() => setCurrentMainTab('fields')}
                    >
                      <i className="bi bi-plus-circle me-1" /> Add Plantings in Fields
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Quick Contacts, Location & Actions */}
            <div className="col-12 col-lg-5">
              {/* Management & Contact Card */}
              <div className="card shadow-sm border-0 rounded-4 p-4 bg-white mb-4">
                <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-person-badge-fill text-success" />
                  Farm Management & Contacts
                </h5>
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Manager:</span>
                    <strong className="text-dark">{farm?.management?.managerName || 'Self / Owner Managed'}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Contact Person:</span>
                    <strong className="text-dark">{farm?.management?.contactPerson || 'Not specified'}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Phone:</span>
                    {farm?.management?.contactPhone ? (
                      <a href={`tel:${farm.management.contactPhone}`} className="text-decoration-none fw-semibold">
                        <i className="bi bi-telephone me-1" />{farm.management.contactPhone}
                      </a>
                    ) : (
                      <span className="text-muted">Not specified</span>
                    )}
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Email:</span>
                    {farm?.management?.contactEmail ? (
                      <a href={`mailto:${farm.management.contactEmail}`} className="text-decoration-none fw-semibold">
                        <i className="bi bi-envelope me-1" />{farm.management.contactEmail}
                      </a>
                    ) : (
                      <span className="text-muted">Not specified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Location & GPS Summary */}
              <div className="card shadow-sm border-0 rounded-4 p-4 bg-white mb-4">
                <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-geo-alt-fill text-danger" />
                  Geographical Coordinates
                </h5>
                <p className="small text-secondary mb-2">
                  {[farm?.location?.village, farm?.location?.tehsil, farm?.location?.district, farm?.location?.state || farm?.location?.region, farm?.location?.country].filter(Boolean).join(', ') || 'India'}
                </p>
                {farm?.location?.latitude != null && farm?.location?.longitude != null ? (
                  <div className="p-2-5 bg-light rounded-3 border small mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Latitude:</span>
                      <strong>{Number(farm.location.latitude).toFixed(4)}°</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Longitude:</span>
                      <strong>{Number(farm.location.longitude).toFixed(4)}°</strong>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${farm.location.latitude},${farm.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                    >
                      <i className="bi bi-box-arrow-up-right" /> Open in Google Maps
                    </a>
                  </div>
                ) : (
                  <p className="text-muted small fst-italic">GPS coordinates not configured.</p>
                )}
                <Link to={`/mapping?farmId=${farmId}`} className="btn btn-outline-success btn-sm w-100 d-flex align-items-center justify-content-center gap-1">
                  <i className="bi bi-map" /> View Field Boundary Mapping
                </Link>
              </div>

              {/* Quick Actions Card */}
              <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
                <h5 className="fw-bold text-dark mb-3">Quick Actions</h5>
                <div className="d-grid gap-2">
                  <button
                    type="button"
                    className="btn btn-success fw-semibold d-flex align-items-center justify-content-center gap-2"
                    onClick={() => setFarmEditModalOpen(true)}
                  >
                    <i className="bi bi-pencil-square" /> Edit Complete Farm Profile
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-2"
                    onClick={() => setCurrentMainTab('fields')}
                  >
                    <i className="bi bi-grid-plus" /> Manage Plots & Fields
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-2"
                    onClick={() => setCurrentMainTab('history')}
                  >
                    <i className="bi bi-clock-history" /> View Activity Timeline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOCATION */}
      {currentMainTab === 'location' && (
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-pin-map-fill text-danger" /> Geographical Address & Boundary
                </h5>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  onClick={() => setFarmEditModalOpen(true)}
                >
                  <i className="bi bi-pencil me-1" /> Edit Location
                </button>
              </div>

              <div className="table-responsive">
                <table className="table table-borderless table-sm mb-0">
                  <tbody>
                    <tr><td className="text-muted" style={{ width: '160px' }}>Country:</td><td className="fw-semibold">{farm?.location?.country || 'India'}</td></tr>
                    <tr><td className="text-muted">State / Region:</td><td className="fw-semibold">{farm?.location?.state || farm?.location?.region || 'Not specified'}</td></tr>
                    <tr><td className="text-muted">District:</td><td className="fw-semibold">{farm?.location?.district || 'Not specified'}</td></tr>
                    <tr><td className="text-muted">Tehsil / Taluka:</td><td className="fw-semibold">{farm?.location?.tehsil || 'Not specified'}</td></tr>
                    <tr><td className="text-muted">Village / Town:</td><td className="fw-semibold">{farm?.location?.village || 'Not specified'}</td></tr>
                    <tr><td className="text-muted">Full Address:</td><td className="fw-semibold">{farm?.location?.address || 'Not specified'}</td></tr>
                    <tr><td className="text-muted">Postal / PIN Code:</td><td className="fw-semibold">{farm?.location?.postalCode || 'Not specified'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
              <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-crosshair text-success" /> GPS Positioning
              </h5>
              <div className="p-3 bg-light rounded-3 border mb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted">Latitude:</span>
                  <strong className="font-monospace fs-6">{farm?.location?.latitude != null ? Number(farm.location.latitude).toFixed(6) : 'N/A'}</strong>
                </div>
                <div className="d-flex justify-content-between mb-3">
                  <span className="text-muted">Longitude:</span>
                  <strong className="font-monospace fs-6">{farm?.location?.longitude != null ? Number(farm.location.longitude).toFixed(6) : 'N/A'}</strong>
                </div>

                {farm?.location?.latitude != null && farm?.location?.longitude != null && (
                  <div className="d-grid gap-2">
                    <a
                      href={`https://www.google.com/maps?q=${farm.location.latitude},${farm.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-center gap-1"
                    >
                      <i className="bi bi-box-arrow-up-right" /> Open in Google Maps
                    </a>
                    <Link
                      to={`/monitoring`}
                      className="btn btn-outline-success btn-sm d-flex align-items-center justify-content-center gap-1"
                    >
                      <i className="bi bi-cloud-sun" /> View Live Meteorological Model
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAND AND SOIL */}
      {currentMainTab === 'land' && (
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-aspect-ratio text-success" /> Land & Area Breakdown
                </h5>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  onClick={() => setFarmEditModalOpen(true)}
                >
                  <i className="bi bi-pencil me-1" /> Edit Land Details
                </button>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <small className="text-muted d-block mb-1">Total Area</small>
                    <strong className="fs-5 text-dark">{displayedTotalArea}</strong>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <small className="text-muted d-block mb-1">Cultivable</small>
                    <strong className="fs-5 text-primary">{displayedCultivable}</strong>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <small className="text-muted d-block mb-1">Irrigated</small>
                    <strong className="fs-5 text-info">{displayedIrrigated}</strong>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <small className="text-muted d-block mb-1">Non-Cultivable</small>
                    <strong className="fs-5 text-secondary">
                      {farm?.landDetails?.nonCultivableArea ? `${farm.landDetails.nonCultivableArea} ${farm.landDetails.areaUnit || 'Acres'}` : '0'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="border-top pt-3">
                <h6 className="fw-bold text-dark mb-2">Soil & Terrain Profile</h6>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge bg-success-subtle text-success p-2 rounded-3 fs-6 fw-normal">
                    <i className="bi bi-layers me-1" /> Soil Type: <strong>{farm?.landDetails?.soilType || 'Alluvial'}</strong>
                  </span>
                  <span className="badge bg-info-subtle text-info p-2 rounded-3 fs-6 fw-normal">
                    <i className="bi bi-globe me-1" /> Terrain: <strong>{farm?.landDetails?.landTerrain || 'Flat / Plain'}</strong>
                  </span>
                  <span className="badge bg-light text-dark border p-2 rounded-3 fs-6 fw-normal">
                    <i className="bi bi-rulers me-1" /> Primary Unit: <strong>{farm?.landDetails?.areaUnit || 'Acres'}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
              <h5 className="fw-bold text-dark mb-3">Field Aggregation</h5>
              <div className="p-3 bg-light rounded-3 border mb-3">
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted">Total Configured Plots:</span>
                  <strong>{fields.length}</strong>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted">Field Measured Area:</span>
                  <strong>{totalAreaHa.toFixed(2)} Hectares</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Equivalent in Acres:</span>
                  <strong>~{totalAcresFromFields} Acres</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-success btn-sm w-100"
                onClick={() => setCurrentMainTab('fields')}
              >
                <i className="bi bi-grid-3x3-gap me-1" /> View Field Boundary Metrics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INFRASTRUCTURE */}
      {currentMainTab === 'infrastructure' && (
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="card shadow-sm border-0 rounded-4 p-4 bg-white h-100">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-droplet-fill text-info" /> Irrigation & Water Network
                </h5>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  onClick={() => setFarmEditModalOpen(true)}
                >
                  <i className="bi bi-pencil me-1" /> Edit
                </button>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Water Availability:</span>
                <span className="badge bg-info-subtle text-info fs-6 fw-normal px-3 py-1-5 rounded-pill">
                  {farm?.infrastructure?.waterAvailability || 'Year-round (Perennial)'}
                </span>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Irrigation Sources:</span>
                <div className="d-flex flex-wrap gap-1-5">
                  {farm?.infrastructure?.irrigationSources?.length > 0 ? (
                    farm.infrastructure.irrigationSources.map((s) => (
                      <span key={s} className="badge bg-light text-dark border px-2-5 py-1 rounded-pill">
                        <i className="bi bi-check2 text-success me-1" /> {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small fst-italic">None configured</span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Irrigation Methods:</span>
                <div className="d-flex flex-wrap gap-1-5">
                  {farm?.infrastructure?.irrigationMethods?.length > 0 ? (
                    farm.infrastructure.irrigationMethods.map((m) => (
                      <span key={m} className="badge bg-primary-subtle text-primary px-2-5 py-1 rounded-pill">
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small fst-italic">None configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card shadow-sm border-0 rounded-4 p-4 bg-white h-100">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-lightning-charge-fill text-warning" /> Power & Storage Assets
                </h5>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  onClick={() => setFarmEditModalOpen(true)}
                >
                  <i className="bi bi-pencil me-1" /> Edit
                </button>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Electricity Supply:</span>
                <span className="badge bg-warning-subtle text-warning fs-6 fw-normal px-3 py-1-5 rounded-pill">
                  {farm?.infrastructure?.electricityAvailability || '24/7 Grid Power'}
                </span>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Greenhouse / Protected Cultivation:</span>
                <span className="badge bg-light text-dark border fs-6 fw-normal px-3 py-1-5 rounded-pill">
                  {farm?.infrastructure?.greenhousePolyhouse || 'None'}
                </span>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Storage Sheds & Warehouses:</span>
                <div className="d-flex flex-wrap gap-1-5">
                  {farm?.infrastructure?.storageFacilities?.length > 0 ? (
                    farm.infrastructure.storageFacilities.map((f) => (
                      <span key={f} className="badge bg-light text-dark border px-2-5 py-1 rounded-pill">
                        <i className="bi bi-building me-1 text-secondary" /> {f}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small fst-italic">None configured</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-muted small d-block mb-1">Farm Machinery & Drone Units:</span>
                <div className="d-flex flex-wrap gap-1-5">
                  {farm?.infrastructure?.farmEquipment?.length > 0 ? (
                    farm.infrastructure.farmEquipment.map((eq) => (
                      <span key={eq} className="badge bg-dark text-white px-2-5 py-1 rounded-pill">
                        {eq}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small fst-italic">None configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AGRICULTURAL INFORMATION */}
      {currentMainTab === 'agricultural' && (
        <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-flower1 text-success" /> Agricultural Systems & Practices
            </h5>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={() => setFarmEditModalOpen(true)}
            >
              <i className="bi bi-pencil me-1" /> Edit Agricultural Profile
            </button>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-6">
              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Primary Crops Cultivated:</span>
                <div className="d-flex flex-wrap gap-1-5">
                  {farm?.agriculturalDetails?.primaryCrops?.length > 0 ? (
                    farm.agriculturalDetails.primaryCrops.map((c) => (
                      <span key={c} className="badge bg-success-subtle text-success fs-6 fw-normal px-3 py-1-5 rounded-pill">
                        <i className="bi bi-sprout me-1" /> {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small fst-italic">No primary crops entered yet</span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Farming Method:</span>
                <span className="badge bg-primary-subtle text-primary fs-6 fw-normal px-3 py-1-5 rounded-pill">
                  {farm?.agriculturalDetails?.farmingMethod || 'Conventional'}
                </span>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Active Agricultural Seasons:</span>
                <div className="d-flex flex-wrap gap-1-5">
                  {farm?.agriculturalDetails?.farmingSeasons?.length > 0 ? (
                    farm.agriculturalDetails.farmingSeasons.map((s) => (
                      <span key={s} className="badge bg-light text-dark border px-2-5 py-1 rounded-pill">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small fst-italic">Standard seasonal</span>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Organic Certification Status:</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle fs-6 fw-normal px-3 py-1-5 rounded-pill">
                  <i className="bi bi-patch-check-fill text-success me-1" />
                  {farm?.agriculturalDetails?.organicCertStatus || 'Not Certified'}
                </span>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Soil Fertility Level:</span>
                <span className="badge bg-secondary-subtle text-dark fs-6 fw-normal px-3 py-1-5 rounded-pill">
                  {farm?.agriculturalDetails?.soilFertility || 'Medium'}
                </span>
              </div>

              <div className="mb-3">
                <span className="text-muted small d-block mb-1">Typical Annual Rainfall:</span>
                <span className="badge bg-light text-dark border fs-6 fw-normal px-3 py-1-5 rounded-pill">
                  {farm?.agriculturalDetails?.annualRainfallMm ? `${farm.agriculturalDetails.annualRainfallMm} mm / year` : 'Not specified'}
                </span>
              </div>

              {farm?.agriculturalDetails?.agriculturalNotes && (
                <div className="p-3 bg-light rounded-3 border">
                  <small className="text-muted d-block fw-semibold mb-1">Agronomic Notes:</small>
                  <p className="small text-secondary mb-0">{farm.agriculturalDetails.agriculturalNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: FARM IMAGES & DOCUMENTS */}
      {currentMainTab === 'images' && (
        <div className="d-flex flex-column gap-4">
          {/* Cover Image Upload & Showcase Card */}
          <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-image-fill text-success" /> Farm Cover Image
            </h5>

            {coverUploadNotice && (
              <div className="alert alert-success py-2 px-3 small mb-3">{coverUploadNotice}</div>
            )}

            <div className="row g-4 align-items-center">
              <div className="col-12 col-md-6">
                {farm?.coverImage ? (
                  <div className="rounded-3 overflow-hidden shadow-sm position-relative" style={{ maxHeight: '240px' }}>
                    <img
                      src={farm.coverImage}
                      alt={farm.name}
                      className="w-100 h-100 object-fit-cover"
                      style={{ maxHeight: '240px' }}
                    />
                  </div>
                ) : (
                  <div className="p-5 text-center bg-light rounded-3 border">
                    <i className="bi bi-image fs-1 text-muted d-block mb-2" />
                    <span className="text-muted small">No cover image uploaded for this farm yet.</span>
                  </div>
                )}
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold small text-dark">Upload New Cover Photo</label>
                <input
                  type="file"
                  className="form-control mb-2"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverImageUpload}
                  disabled={uploadingCover}
                />
                <small className="text-muted d-block mb-3">
                  Accepted formats: JPEG, PNG, WebP (up to 10MB). Image is securely validated and processed.
                </small>

                {farm?.coverImage && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={handleRemoveCoverImage}
                    disabled={uploadingCover}
                  >
                    <i className="bi bi-trash me-1" /> Remove Cover Image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Field Photographs Consolidated Gallery */}
          <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-camera-fill text-primary" />
                Field Visual History & Photographs ({photos.length})
              </h5>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setCurrentMainTab('fields')}
              >
                Go to Field Management <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>

            {photos.length > 0 ? (
              <div className="row g-3">
                {photos.map((photo) => (
                  <div key={photo._id} className="col-6 col-sm-4 col-md-3">
                    <div
                      className="card shadow-sm border-0 rounded-3 overflow-hidden h-100 cursor-pointer hover-shadow"
                      onClick={() => setPreviewPhoto(photo)}
                    >
                      <AuthenticatedImage
                        storageKey={photo.storageKey || photo.publicId}
                        storageProvider={photo.storageProvider || 'local'}
                        alt={photo.notes || 'Field Photo'}
                        className="w-100 object-fit-cover"
                        style={{ height: '140px' }}
                      />
                      <div className="p-2 small">
                        <span className="fw-semibold text-dark d-block text-truncate">
                          {fields.find((f) => f._id === photo.fieldId)?.name || 'Field Plot'}
                        </span>
                        <span className="text-muted small d-block">
                          {photo.capturedAt ? new Date(photo.capturedAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center bg-light rounded-3 border">
                <i className="bi bi-camera fs-2 text-muted d-block mb-2" />
                <p className="text-muted small mb-0">No field photographs taken yet. You can upload photographs inside any field plot.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: MANAGEMENT AND CONTACTS */}
      {currentMainTab === 'management' && (
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-person-lines-fill text-success" /> Farm Administration & Contacts
                </h5>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  onClick={() => setFarmEditModalOpen(true)}
                >
                  <i className="bi bi-pencil me-1" /> Edit Contacts
                </button>
              </div>

              <div className="table-responsive">
                <table className="table table-borderless table-sm mb-0">
                  <tbody>
                    <tr><td className="text-muted" style={{ width: '180px' }}>Farm Status:</td><td><span className="badge bg-success-subtle text-success">{farm?.management?.farmStatus || 'Active'}</span></td></tr>
                    <tr><td className="text-muted">Assigned Manager:</td><td className="fw-semibold">{farm?.management?.managerName || 'Self / Owner Managed'}</td></tr>
                    <tr><td className="text-muted">Contact Person:</td><td className="fw-semibold">{farm?.management?.contactPerson || 'Not specified'}</td></tr>
                    <tr>
                      <td className="text-muted">Phone Number:</td>
                      <td>
                        {farm?.management?.contactPhone ? (
                          <a href={`tel:${farm.management.contactPhone}`} className="text-decoration-none fw-semibold">
                            <i className="bi bi-telephone me-1" />{farm.management.contactPhone}
                          </a>
                        ) : 'Not specified'}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">Email Address:</td>
                      <td>
                        {farm?.management?.contactEmail ? (
                          <a href={`mailto:${farm.management.contactEmail}`} className="text-decoration-none fw-semibold">
                            <i className="bi bi-envelope me-1" />{farm.management.contactEmail}
                          </a>
                        ) : 'Not specified'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {farm?.management?.internalNotes && (
                <div className="mt-4 pt-3 border-top">
                  <span className="small text-muted fw-semibold d-block mb-1">Internal Operational Notes:</span>
                  <div className="p-3 bg-light rounded-3 border small text-secondary">
                    {farm.management.internalNotes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: ACTIVITY HISTORY */}
      {currentMainTab === 'history' && (
        <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
          <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-clock-history text-success" />
            Unified Farm Operations & Crop Activity Timeline
          </h5>

          {combinedHistory.length > 0 ? (
            <div className="d-flex flex-column gap-3">
              {combinedHistory.map((item) => (
                <div key={item.id} className="p-3 bg-light rounded-3 border d-flex align-items-start gap-3">
                  <span className="badge bg-white text-dark border p-2 rounded-3 fs-5 flex-shrink-0">
                    <i className={
                      item.kind === 'activity' ? 'bi bi-droplet-half text-primary' :
                      item.kind === 'task' ? 'bi bi-check2-square text-warning' :
                      item.kind === 'harvest' ? 'bi bi-basket2 text-success' : 'bi bi-sprout text-success'
                    } />
                  </span>

                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-1">
                      <strong className="text-dark fs-6">{item.title}</strong>
                      <span className="badge bg-white text-secondary border small">
                        {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>

                    <p className="text-secondary small mb-1">{item.subtitle}</p>

                    <div className="d-flex flex-wrap gap-2 small text-muted">
                      <span><i className="bi bi-grid me-1" /> Plot: <strong>{item.field}</strong></span>
                      {item.performedBy && <span>• By: <strong>{item.performedBy}</strong></span>}
                      {item.assignee && <span>• Assignee: <strong>{item.assignee}</strong></span>}
                      {item.cost ? <span>• Cost: <strong>₹{item.cost}</strong></span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center bg-light rounded-3 border">
              <i className="bi bi-clock-history fs-2 text-muted d-block mb-2" />
              <p className="text-muted small mb-0">No recorded activities, tasks, or harvest milestones on this farm yet.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: FIELDS AND PLOTS (The complete existing interactive field management layout) */}
      {currentMainTab === 'fields' && (
<div className="row g-4 align-items-start">
        <div className="col-12 col-xl-7">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('operations.eyebrow')}</span>
              <h2>{t('farms.totalFields')} <span className="count-chip">{fields.length}</span></h2>
            </div>
          </div>

          {fields.length ? (
            <div className="field-list">
              {fields.map((field) => {
                const fieldCycles = cropCycles.filter((c) => c.fieldId === field._id);
                const activeCycle = fieldCycles.find((c) => c.status === 'active');
                const historyCycles = fieldCycles.filter((c) => c.status !== 'active');
                const fieldActivities = activities.filter((a) => a.fieldId === field._id);
                const fieldTasks = tasks.filter((t) => t.fieldId === field._id);
                const fieldPhotos = photos
                  .filter((p) => String(p.fieldId) === String(field._id))
                  .sort((a, b) => new Date(b.capturedAt || b.createdAt).getTime() - new Date(a.capturedAt || a.createdAt).getTime());
                const daysInGround = activeCycle ? getDaysInGround(activeCycle.plantingDate) : null;

                const currentTab = fieldSubtabs[field._id] || 'cycles';
                const currentTaskFilter = taskFilterState[field._id] || 'all';
                const currentPhotoView = photoViewMode[field._id] || 'gallery';

                const filteredFieldTasks = fieldTasks.filter((t) => {
                  if (currentTaskFilter === 'pending') return t.status !== 'completed' && t.status !== 'cancelled';
                  if (currentTaskFilter === 'completed') return t.status === 'completed';
                  return true;
                });

                const isPlanting = plantingFieldId === field._id;
                const isCompleting = completingCycleId === activeCycle?._id;
                const isLoggingActivity = activityFieldId === field._id;
                const isAddingTask = taskFieldId === field._id;
                const isAddingPhoto = photoFieldId === field._id;

                return (
                  <Card className="field-card" key={field._id}>
                    <div className="field-card-top">
                      <div className="farm-icon field-icon" aria-hidden="true">
                        <i className="bi bi-bounding-box" />
                      </div>

                      {editingId === field._id ? (
                        <form
                          className="field-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            saveField(field._id);
                          }}
                        >
                          <div className="field-edit-grid">
                            <div>
                              <label className="form-label" htmlFor={`field-name-${field._id}`}>{t('farms.fieldNameLabel')}</label>
                              <input
                                id={`field-name-${field._id}`}
                                className="form-control"
                                value={editForm.name}
                                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                                maxLength={100}
                                required
                              />
                            </div>
                            <div>
                              <label className="form-label" htmlFor={`field-area-${field._id}`}>{t('farms.fieldAreaLabel')}</label>
                              <input
                                id={`field-area-${field._id}`}
                                className="form-control"
                                type="number"
                                min="0.01"
                                max="1000000"
                                step="0.01"
                                inputMode="decimal"
                                value={editForm.areaHectares}
                                onChange={(event) => setEditForm((current) => ({ ...current, areaHectares: event.target.value }))}
                                required
                              />
                            </div>
                            <div>
                              <label className="form-label" htmlFor={`field-soil-${field._id}`}>{t('farms.soilTypeLabel')}</label>
                              <input
                                id={`field-soil-${field._id}`}
                                className="form-control"
                                value={editForm.soilType}
                                onChange={(event) => setEditForm((current) => ({ ...current, soilType: event.target.value }))}
                                maxLength={100}
                              />
                            </div>
                            <div>
                              <label className="form-label" htmlFor={`field-water-${field._id}`}>{t('farms.waterSourceLabel')}</label>
                              <input
                                id={`field-water-${field._id}`}
                                className="form-control"
                                value={editForm.waterSource}
                                onChange={(event) => setEditForm((current) => ({ ...current, waterSource: event.target.value }))}
                                maxLength={100}
                              />
                            </div>
                          </div>
                          <div className="field-actions">
                            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                              {saving ? 'Saving…' : 'Save changes'}
                            </button>
                            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setEditingId(null)} disabled={saving}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="field-card-content w-100">
                          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                            <div>
                              <h3>{field.name}</h3>
                              <p className="field-area">
                                {field.areaHectares} hectares
                                {field.calculatedMetrics?.approximateAreaAcres ? ` (${field.calculatedMetrics.approximateAreaAcres} ac approx)` : ''}
                                {field.boundary?.coordinates && (
                                  <span className="badge bg-light text-muted border ms-2" style={{ fontSize: '0.7rem' }} title="User-defined approximate boundary">
                                    <i className="bi bi-geo me-1" />Approx. Boundary
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="field-card-actions">
                              <Link
                                to={`/mapping?farmId=${farmId}&fieldId=${field._id}`}
                                className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1"
                                title="Map boundary on satellite basemap"
                              >
                                <i className="bi bi-map" />
                                <span>{field.boundary?.coordinates?.length ? 'Edit Boundary' : 'Map Boundary'}</span>
                              </Link>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                type="button"
                                onClick={() => {
                                  setEditingId(field._id);
                                  setEditForm({
                                    name: field.name,
                                    areaHectares: String(field.areaHectares),
                                    soilType: field.soilType || '',
                                    waterSource: field.waterSource || '',
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteField(field)} disabled={deletingId === field._id}>
                                {deletingId === field._id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>

                          {(field.soilType || field.waterSource) && (
                            <dl className="field-details">
                              {field.soilType && <><dt>{t('farms.soilTypeLabel')}</dt><dd>{field.soilType}</dd></>}
                              {field.waterSource && <><dt>{t('farms.waterSourceLabel')}</dt><dd>{field.waterSource}</dd></>}
                            </dl>
                          )}

                          {/* Field Subtabs */}
                          <div className="field-subtabs" role="tablist">
                            <button
                              type="button"
                              className={`field-subtab-btn ${currentTab === 'cycles' ? 'active' : ''}`}
                              onClick={() => setSubtab(field._id, 'cycles')}
                            >
                              <i className="bi bi-sprout me-1" />
                              Crop Lifecycle {activeCycle ? `(${activeCycle.cropName})` : ''}
                            </button>
                            <button
                              type="button"
                              className={`field-subtab-btn ${currentTab === 'activities' ? 'active' : ''}`}
                              onClick={() => setSubtab(field._id, 'activities')}
                            >
                              <i className="bi bi-activity me-1" />
                              Activities ({fieldActivities.length})
                            </button>
                            <button
                              type="button"
                              className={`field-subtab-btn ${currentTab === 'tasks' ? 'active' : ''}`}
                              onClick={() => setSubtab(field._id, 'tasks')}
                            >
                              <i className="bi bi-check2-square me-1" />
                              Tasks ({fieldTasks.length})
                            </button>
                            <button
                              type="button"
                              className={`field-subtab-btn ${currentTab === 'photos' ? 'active' : ''}`}
                              onClick={() => setSubtab(field._id, 'photos')}
                            >
                              <i className="bi bi-camera me-1" />
                              Photographs ({fieldPhotos.length})
                            </button>
                          </div>

                          {/* Tab 1: Operational Crop Cycle Workspace */}
                          {currentTab === 'cycles' && (
                            <div className="field-operational-box">
                              {activeCycle ? (
                                <div>
                                  <div className="crop-active-header">
                                    <div className="crop-title-group">
                                      <h4>
                                        <i className="bi bi-sprout text-success" aria-hidden="true" />
                                        {activeCycle.cropName}
                                        {activeCycle.variety && <span className="crop-variety">({activeCycle.variety})</span>}
                                      </h4>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                      {activeCycle.season && <Badge tone="neutral">{activeCycle.season}</Badge>}
                                      <Badge tone={activeCycle.stage || 'sowing'}>
                                        {activeCycle.stage}
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="crop-meta-row">
                                    <span className="crop-meta-item">
                                      <i className="bi bi-calendar3" aria-hidden="true" />
                                      Planted: {new Date(activeCycle.plantingDate).toLocaleDateString()}
                                    </span>
                                    {daysInGround !== null && (
                                      <span className="crop-meta-item text-success fw-semibold">
                                        <i className="bi bi-stopwatch" aria-hidden="true" />
                                        Day {daysInGround} in ground
                                      </span>
                                    )}
                                    {activeCycle.expectedHarvestDate && (
                                      <span className="crop-meta-item">
                                        <i className="bi bi-bullseye" aria-hidden="true" />
                                        Expected harvest: {new Date(activeCycle.expectedHarvestDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>

                                  {activeCycle.notes && (
                                    <p className="small text-muted mb-2">
                                      <i className="bi bi-sticky me-1" />{activeCycle.notes}
                                    </p>
                                  )}

                                  {/* Lifecycle Stage Progression */}
                                  <div className="mt-2">
                                    <span className="text-secondary small fw-semibold d-block mb-1">{t('farms.advanceLifecycleStage')}</span>
                                    <div className="crop-stage-bar">
                                      {STAGES.map((s) => (
                                        <button
                                          key={s.id}
                                          type="button"
                                          className={`stage-step-btn ${activeCycle.stage === s.id ? 'is-current' : ''}`}
                                          disabled={cycleSaving}
                                          onClick={() => handleUpdateStage(activeCycle, s.id)}
                                        >
                                          <i className={`bi ${s.icon} me-1`} />
                                          {s.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Harvesting form or Actions */}
                                  {isCompleting ? (
                                    <form className="mt-3 p-3 bg-white border rounded" onSubmit={(e) => handleCompleteCycle(activeCycle, e)}>
                                      <h6>{t('farms.recordHarvestTitle')}</h6>
                                      <div className="mb-2">
                                        <label className="form-label small" htmlFor={`harvest-date-${activeCycle._id}`}>{t('farms.harvestDateLabel')}</label>
                                        <input
                                          id={`harvest-date-${activeCycle._id}`}
                                          type="date"
                                          className="form-control form-control-sm"
                                          value={harvestDate}
                                          onChange={(e) => setHarvestDate(e.target.value)}
                                          required
                                        />
                                      </div>
                                      <div className="row g-2 mb-3">
                                        <div className="col-8">
                                          <label className="form-label small" htmlFor={`harvest-yield-${activeCycle._id}`}>{t('farms.harvestYieldLabel')}</label>
                                          <input
                                            id={`harvest-yield-${activeCycle._id}`}
                                            type="number"
                                            step="any"
                                            min="0"
                                            inputMode="decimal"
                                            placeholder="e.g. 4200"
                                            className="form-control form-control-sm"
                                            value={harvestYield}
                                            onChange={(e) => setHarvestYield(e.target.value)}
                                          />
                                        </div>
                                        <div className="col-4">
                                          <label className="form-label small" htmlFor={`harvest-unit-${activeCycle._id}`}>{t('farms.unitLabel')}</label>
                                          <select
                                            id={`harvest-unit-${activeCycle._id}`}
                                            className="form-select form-select-sm"
                                            value={harvestYieldUnit}
                                            onChange={(e) => setHarvestYieldUnit(e.target.value)}
                                          >
                                            <option value="kg">kg</option>
                                            <option value="tonnes">{t('farms.unitTonnes')}</option>
                                            <option value="quintals">{t('farms.unitQuintals')}</option>
                                            <option value="bags">{t('farms.unitBags')}</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="d-flex gap-2">
                                        <button className="btn btn-success btn-sm" type="submit" disabled={cycleSaving}>
                                          {cycleSaving ? t('common.saving') : t('farms.confirmHarvest')}
                                        </button>
                                        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setCompletingCycleId(null)} disabled={cycleSaving}>
                                          {t('common.cancel')}
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <div className="crop-actions-row">
                                      <button
                                        className="btn btn-outline-success btn-sm"
                                        type="button"
                                        onClick={() => setCompletingCycleId(activeCycle._id)}
                                        disabled={cycleSaving}
                                      >
                                        <i className="bi bi-check2-circle me-1" />
                                        Mark Harvested & Complete
                                      </button>
                                      <button
                                        className="btn btn-link text-danger p-0 small text-decoration-none"
                                        type="button"
                                        onClick={() => handleDeleteCycle(activeCycle)}
                                        disabled={cycleSaving}
                                      >
                                        Delete cycle
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : isPlanting ? (
                                <form className="p-3 bg-white border rounded" onSubmit={(e) => handlePlantCrop(field._id, e)}>
                                  <h5>Plant a new crop on {field.name}</h5>
                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-6">
                                      <label className="form-label small" htmlFor={`crop-name-${field._id}`}>{t('farms.cropNameLabel')} *</label>
                                      <input
                                        id={`crop-name-${field._id}`}
                                        className="form-control form-control-sm"
                                        placeholder="e.g. Wheat, Maize, Tomato"
                                        value={plantForm.cropName}
                                        onChange={(e) => setPlantForm((p) => ({ ...p, cropName: e.target.value }))}
                                        maxLength={100}
                                        required
                                      />
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <label className="form-label small" htmlFor={`crop-variety-${field._id}`}>{t('farms.cropVarietyLabel')}</label>
                                      <input
                                        id={`crop-variety-${field._id}`}
                                        className="form-control form-control-sm"
                                        placeholder="e.g. PBW-343"
                                        value={plantForm.variety}
                                        onChange={(e) => setPlantForm((p) => ({ ...p, variety: e.target.value }))}
                                        maxLength={100}
                                      />
                                    </div>
                                  </div>
                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor={`crop-season-${field._id}`}>{t('farms.cropSeasonLabel')}</label>
                                      <input
                                        id={`crop-season-${field._id}`}
                                        className="form-control form-control-sm"
                                        placeholder="e.g. Rabi, Kharif"
                                        value={plantForm.season}
                                        onChange={(e) => setPlantForm((p) => ({ ...p, season: e.target.value }))}
                                        maxLength={50}
                                      />
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor={`crop-plant-date-${field._id}`}>{t('farms.plantingDateLabel')} *</label>
                                      <input
                                        id={`crop-plant-date-${field._id}`}
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={plantForm.plantingDate}
                                        onChange={(e) => setPlantForm((p) => ({ ...p, plantingDate: e.target.value }))}
                                        required
                                      />
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor={`crop-exp-date-${field._id}`}>{t('farms.expectedHarvestLabel')}</label>
                                      <input
                                        id={`crop-exp-date-${field._id}`}
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={plantForm.expectedHarvestDate}
                                        min={plantForm.plantingDate}
                                        onChange={(e) => setPlantForm((p) => ({ ...p, expectedHarvestDate: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div className="mb-2">
                                    <label className="form-label small" htmlFor={`crop-notes-${field._id}`}>{t('common.notes')}</label>
                                    <input
                                      id={`crop-notes-${field._id}`}
                                      className="form-control form-control-sm"
                                      placeholder="Optional seeding notes, fertilizer applied..."
                                      value={plantForm.notes}
                                      onChange={(e) => setPlantForm((p) => ({ ...p, notes: e.target.value }))}
                                      maxLength={1000}
                                    />
                                  </div>
                                  <div className="d-flex gap-2">
                                    <button className="btn btn-primary btn-sm" type="submit" disabled={cycleSaving}>
                                      {cycleSaving ? t('common.saving') : t('farms.quickAddField')}
                                    </button>
                                    <button
                                      className="btn btn-outline-secondary btn-sm"
                                      type="button"
                                      onClick={() => {
                                        setPlantingFieldId(null);
                                        setPlantForm(createEmptyPlanting());
                                      }}
                                      disabled={cycleSaving}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div className="field-empty-crop">
                                  <span className="field-empty-crop-text">
                                    <i className="bi bi-circle text-muted" aria-hidden="true" />
                                    No active crop recorded for this field.
                                  </span>
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    type="button"
                                    onClick={() => {
                                      setPlantingFieldId(field._id);
                                      setPlantForm(createEmptyPlanting());
                                    }}
                                  >
                                    <i className="bi bi-sprout me-1" />
                                    Plant a crop
                                  </button>
                                </div>
                              )}

                              {/* Historical Crop Cycles */}
                              {historyCycles.length > 0 && (
                                <div className="mt-2">
                                  <button
                                    className="crop-history-toggle"
                                    type="button"
                                    onClick={() => toggleHistory(field._id)}
                                  >
                                    <i className={`bi ${expandedHistory[field._id] ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
                                    Past crop cycles ({historyCycles.length})
                                  </button>
                                  {expandedHistory[field._id] && (
                                    <div className="crop-history-list">
                                      {historyCycles.map((h) => (
                                        <div className="crop-history-item" key={h._id}>
                                          <div>
                                            <strong>{h.cropName}</strong>
                                            {h.variety && <span className="text-muted ms-1">({h.variety})</span>}
                                            {h.season && <span className="badge bg-light text-dark ms-2">{h.season}</span>}
                                            <div className="small text-muted mt-1">
                                              Planted: {new Date(h.plantingDate).toLocaleDateString()}
                                              {h.harvestDate && ` • Harvested: ${new Date(h.harvestDate).toLocaleDateString()}`}
                                            </div>
                                          </div>
                                          <div className="d-flex align-items-center gap-2">
                                            <Badge tone={h.status === 'completed' ? 'harvested' : 'cancelled'}>
                                              {h.status}
                                            </Badge>
                                            <button
                                              className="btn btn-link text-danger p-0"
                                              type="button"
                                              title="Delete historical record"
                                              onClick={() => handleDeleteCycle(h)}
                                            >
                                              <i className="bi bi-trash3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tab 2: Field Activities Timeline */}
                          {currentTab === 'activities' && (
                            <div className="field-operational-box">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="small text-muted fw-semibold">Logged field operations ({fieldActivities.length})</span>
                                <button
                                  className="btn btn-primary btn-sm"
                                  type="button"
                                  onClick={() => openActivityForm(field._id, activeCycle?._id)}
                                >
                                  <i className="bi bi-plus-lg me-1" /> Log activity
                                </button>
                              </div>

                              {isLoggingActivity && (
                                <form className="p-3 mb-3 bg-white border rounded" onSubmit={(e) => handleSubmitActivity(field._id, e)}>
                                  <h6>Log new field activity on {field.name}</h6>
                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-6">
                                      <label className="form-label small" htmlFor={`act-type-${field._id}`}>{t('operations.activityTypeLabel')} *</label>
                                      <select
                                        id={`act-type-${field._id}`}
                                        className="form-select form-select-sm"
                                        value={activityForm.type}
                                        onChange={(e) => setActivityForm((p) => ({ ...p, type: e.target.value }))}
                                        required
                                      >
                                        {ACTIVITY_TYPES.map((a) => (
                                          <option key={a.id} value={a.id}>{a.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <label className="form-label small" htmlFor={`act-date-${field._id}`}>{t('farms.dateOccurredLabel')} *</label>
                                      <input
                                        id={`act-date-${field._id}`}
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={activityForm.date}
                                        onChange={(e) => setActivityForm((p) => ({ ...p, date: e.target.value }))}
                                        required
                                      />
                                    </div>
                                  </div>

                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-6">
                                      <label className="form-label small" htmlFor={`act-performer-${field._id}`}>{t('operations.performedByLabel')}</label>
                                      <input
                                        id={`act-performer-${field._id}`}
                                        className="form-control form-control-sm"
                                        placeholder="e.g. Self, Worker name"
                                        value={activityForm.performedBy}
                                        onChange={(e) => setActivityForm((p) => ({ ...p, performedBy: e.target.value }))}
                                        maxLength={100}
                                      />
                                    </div>
                                    <div className="col-12 col-md-6">
                                      <label className="form-label small" htmlFor={`act-cost-${field._id}`}>{t('farms.activityCostLabel')}</label>
                                      <input
                                        id={`act-cost-${field._id}`}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        className="form-control form-control-sm"
                                        placeholder="Optional cost"
                                        value={activityForm.cost}
                                        onChange={(e) => setActivityForm((p) => ({ ...p, cost: e.target.value }))}
                                      />
                                    </div>
                                  </div>

                                  {/* Inputs list */}
                                  <div className="mb-2">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <label className="form-label small mb-0">{t('farms.materialsInputsApplied')}</label>
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm p-0 text-decoration-none"
                                        onClick={addActivityInputRow}
                                      >
                                        <i className="bi bi-plus-circle me-1" /> Add input item
                                      </button>
                                    </div>
                                    {activityForm.inputs.map((inp, idx) => (
                                      <div key={idx} className="row g-1 mb-1 align-items-center">
                                        <div className="col-5">
                                          <input
                                            className="form-control form-control-sm"
                                            placeholder="Input name (e.g. Urea)"
                                            value={inp.name}
                                            onChange={(e) => updateActivityInputRow(idx, 'name', e.target.value)}
                                            required
                                          />
                                        </div>
                                        <div className="col-3">
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            inputMode="decimal"
                                            className="form-control form-control-sm"
                                            placeholder="Qty"
                                            value={inp.quantity}
                                            onChange={(e) => updateActivityInputRow(idx, 'quantity', e.target.value)}
                                            required
                                          />
                                        </div>
                                        <div className="col-3">
                                          <input
                                            className="form-control form-control-sm"
                                            placeholder="Unit (kg, L)"
                                            value={inp.unit}
                                            onChange={(e) => updateActivityInputRow(idx, 'unit', e.target.value)}
                                          />
                                        </div>
                                        <div className="col-1 text-center">
                                          <button
                                            type="button"
                                            className="btn btn-link text-danger p-0"
                                            title="Remove item"
                                            onClick={() => removeActivityInputRow(idx)}
                                          >
                                            <i className="bi bi-x-circle" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mb-2">
                                    <label className="form-label small" htmlFor={`act-notes-${field._id}`}>{t('farms.observationNotesLabel')}</label>
                                    <input
                                      id={`act-notes-${field._id}`}
                                      className="form-control form-control-sm"
                                      placeholder="Details about water volume, pests spotted, weather..."
                                      value={activityForm.notes}
                                      onChange={(e) => setActivityForm((p) => ({ ...p, notes: e.target.value }))}
                                      maxLength={1000}
                                    />
                                  </div>

                                  <div className="d-flex gap-2">
                                    <button className="btn btn-primary btn-sm" type="submit" disabled={activitySaving}>
                                      {activitySaving ? t('common.saving') : t('operations.logActivity')}
                                    </button>
                                    <button
                                      className="btn btn-outline-secondary btn-sm"
                                      type="button"
                                      onClick={() => setActivityFieldId(null)}
                                      disabled={activitySaving}
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  </div>
                                </form>
                              )}

                              {fieldActivities.length === 0 ? (
                                <div className="p-3 text-center text-muted small bg-light rounded">
                                  <i className="bi bi-activity fs-3 mb-1 d-block" aria-hidden="true" />
                                  No activities recorded for this field yet. Log actual irrigation, fertilizer, or labor events as they happen.
                                </div>
                              ) : (
                                <div className="activity-timeline">
                                  {fieldActivities.map((act) => {
                                    const info = ACTIVITY_TYPES.find((a) => a.id === act.type) || {
                                      label: act.type,
                                      icon: 'bi-dot',
                                      className: '',
                                    };
                                    return (
                                      <div key={act._id} className="activity-timeline-item">
                                        <div className={`activity-node ${info.className}`} aria-hidden="true">
                                          <i className={`bi ${info.icon}`} />
                                        </div>
                                        <div className="activity-card">
                                          <div className="activity-card-header">
                                            <span className="activity-title">
                                              {info.label}
                                            </span>
                                            <div className="d-flex align-items-center gap-2">
                                              <span className="small text-muted">
                                                <i className="bi bi-calendar-event me-1" />
                                                {new Date(act.date).toLocaleDateString()}
                                              </span>
                                              <button
                                                className="btn btn-link text-danger p-0 small"
                                                type="button"
                                                title="Delete activity record"
                                                disabled={deletingActivityId === act._id}
                                                onClick={() => handleDeleteActivity(act._id)}
                                              >
                                                <i className="bi bi-trash3" />
                                              </button>
                                            </div>
                                          </div>
                                          <div className="small text-muted mb-1">
                                            {act.performedBy && <span>By {act.performedBy}</span>}
                                            {act.cost !== undefined && act.cost !== null && (
                                              <span className="ms-2 badge bg-light text-dark border">
                                                ${Number(act.cost).toFixed(2)}
                                              </span>
                                            )}
                                          </div>
                                          {act.notes && <p className="small text-secondary mb-1">“{act.notes}”</p>}
                                          {act.inputs && act.inputs.length > 0 && (
                                            <div>
                                              {act.inputs.map((inp, idx) => (
                                                <span key={idx} className="activity-input-tag">
                                                  <i className="bi bi-box-seam me-1" />
                                                  {inp.quantity} {inp.unit} {inp.name}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tab 3: Field Tasks & Operational Planning */}
                          {currentTab === 'tasks' && (
                            <div className="field-operational-box">
                              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                                <div className="d-flex align-items-center gap-1">
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${currentTaskFilter === 'all' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                    onClick={() => setTaskFilterState((p) => ({ ...p, [field._id]: 'all' }))}
                                  >
                                    All ({fieldTasks.length})
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${currentTaskFilter === 'pending' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                    onClick={() => setTaskFilterState((p) => ({ ...p, [field._id]: 'pending' }))}
                                  >
                                    Pending ({fieldTasks.filter((t) => t.status !== 'completed').length})
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${currentTaskFilter === 'completed' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                    onClick={() => setTaskFilterState((p) => ({ ...p, [field._id]: 'completed' }))}
                                  >
                                    Done ({fieldTasks.filter((t) => t.status === 'completed').length})
                                  </button>
                                </div>
                                <button
                                  className="btn btn-primary btn-sm"
                                  type="button"
                                  onClick={() => openTaskForm(field._id, activeCycle?._id)}
                                >
                                  <i className="bi bi-plus-lg me-1" /> Add task
                                </button>
                              </div>

                              {isAddingTask && (
                                <form className="p-3 mb-3 bg-white border rounded" onSubmit={(e) => handleSubmitTask(field._id, e)}>
                                  <h6>Schedule operational task for {field.name}</h6>
                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-8">
                                      <label className="form-label small" htmlFor={`task-title-${field._id}`}>{t('operations.taskTitleLabel')} *</label>
                                      <input
                                        id={`task-title-${field._id}`}
                                        className="form-control form-control-sm"
                                        placeholder="e.g. Inspect drip emitters, spray pesticide"
                                        value={taskForm.title}
                                        onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                                        maxLength={200}
                                        required
                                      />
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor={`task-type-${field._id}`}>{t('common.type')} *</label>
                                      <select
                                        id={`task-type-${field._id}`}
                                        className="form-select form-select-sm"
                                        value={taskForm.type}
                                        onChange={(e) => setTaskForm((p) => ({ ...p, type: e.target.value }))}
                                        required
                                      >
                                        {TASK_TYPES.map((t) => (
                                          <option key={t.id} value={t.id}>{t.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor={`task-due-${field._id}`}>{t('operations.dueDateLabel')} *</label>
                                      <input
                                        id={`task-due-${field._id}`}
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={taskForm.dueDate}
                                        onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                                        required
                                      />
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor={`task-priority-${field._id}`}>{t('operations.priorityLabel')}</label>
                                      <select
                                        id={`task-priority-${field._id}`}
                                        className="form-select form-select-sm"
                                        value={taskForm.priority}
                                        onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}
                                      >
                                        {TASK_PRIORITIES.map((pr) => (
                                          <option key={pr.id} value={pr.id}>{pr.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor={`task-assignee-${field._id}`}>{t('operations.assigneeLabel')}</label>
                                      <input
                                        id={`task-assignee-${field._id}`}
                                        className="form-control form-control-sm"
                                        placeholder="e.g. John, Team Alpha"
                                        value={taskForm.assignee}
                                        onChange={(e) => setTaskForm((p) => ({ ...p, assignee: e.target.value }))}
                                        maxLength={100}
                                      />
                                    </div>
                                  </div>

                                  <div className="mb-2">
                                    <label className="form-label small" htmlFor={`task-notes-${field._id}`}>{t('operations.notesLabel')}</label>
                                    <input
                                      id={`task-notes-${field._id}`}
                                      className="form-control form-control-sm"
                                      placeholder="Instructions or requirements..."
                                      value={taskForm.notes}
                                      onChange={(e) => setTaskForm((p) => ({ ...p, notes: e.target.value }))}
                                      maxLength={1000}
                                    />
                                  </div>

                                  <div className="d-flex gap-2">
                                    <button className="btn btn-primary btn-sm" type="submit" disabled={taskSaving}>
                                      {taskSaving ? t('common.saving') : t('operations.createTask')}
                                    </button>
                                    <button
                                      className="btn btn-outline-secondary btn-sm"
                                      type="button"
                                      onClick={() => setTaskFieldId(null)}
                                      disabled={taskSaving}
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  </div>
                                </form>
                              )}

                              {editingTaskId && (
                                <form className="p-3 mb-3 bg-white border rounded" onSubmit={(e) => handleSaveEditTask(editingTaskId, e)}>
                                  <h6>{t('operations.editTaskModalTitle')}</h6>
                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-8">
                                      <label className="form-label small" htmlFor="edit-task-title">{t('operations.taskTitleLabel')} *</label>
                                      <input
                                        id="edit-task-title"
                                        className="form-control form-control-sm"
                                        value={editTaskForm.title}
                                        onChange={(e) => setEditTaskForm((p) => ({ ...p, title: e.target.value }))}
                                        maxLength={200}
                                        required
                                      />
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor="edit-task-type">{t('common.type')}</label>
                                      <select
                                        id="edit-task-type"
                                        className="form-select form-select-sm"
                                        value={editTaskForm.type}
                                        onChange={(e) => setEditTaskForm((p) => ({ ...p, type: e.target.value }))}
                                      >
                                        {TASK_TYPES.map((t) => (
                                          <option key={t.id} value={t.id}>{t.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="row g-2 mb-2">
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor="edit-task-due">{t('operations.dueDateLabel')} *</label>
                                      <input
                                        id="edit-task-due"
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={editTaskForm.dueDate}
                                        onChange={(e) => setEditTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                                        required
                                      />
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor="edit-task-priority">{t('operations.priorityLabel')}</label>
                                      <select
                                        id="edit-task-priority"
                                        className="form-select form-select-sm"
                                        value={editTaskForm.priority}
                                        onChange={(e) => setEditTaskForm((p) => ({ ...p, priority: e.target.value }))}
                                      >
                                        {TASK_PRIORITIES.map((pr) => (
                                          <option key={pr.id} value={pr.id}>{pr.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="col-12 col-md-4">
                                      <label className="form-label small" htmlFor="edit-task-assignee">{t('operations.assigneeLabel')}</label>
                                      <input
                                        id="edit-task-assignee"
                                        className="form-control form-control-sm"
                                        value={editTaskForm.assignee}
                                        onChange={(e) => setEditTaskForm((p) => ({ ...p, assignee: e.target.value }))}
                                        maxLength={100}
                                      />
                                    </div>
                                  </div>
                                  <div className="d-flex gap-2">
                                    <button className="btn btn-primary btn-sm" type="submit" disabled={taskSaving}>
                                      {taskSaving ? t('common.saving') : t('common.save')}
                                    </button>
                                    <button
                                      className="btn btn-outline-secondary btn-sm"
                                      type="button"
                                      onClick={() => setEditingTaskId(null)}
                                      disabled={taskSaving}
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  </div>
                                </form>
                              )}

                              {filteredFieldTasks.length === 0 ? (
                                <div className="p-3 text-center text-muted small bg-light rounded">
                                  <i className="bi bi-calendar-check fs-3 mb-1 d-block" aria-hidden="true" />
                                  No tasks match this filter. Use &apos;Add task&apos; to schedule operational work for this field.
                                </div>
                              ) : (
                                <div className="task-list">
                                  {filteredFieldTasks.map((t) => {
                                    const isCompleted = t.status === 'completed';
                                    const dueDay = t.dueDate ? t.dueDate.split('T')[0] : '';
                                    const isOverdue = !isCompleted && dueDay < todayDate;
                                    const isToday = !isCompleted && dueDay === todayDate;

                                    return (
                                      <div key={t._id} className={`task-card ${isCompleted ? 'is-completed' : ''}`}>
                                        <div className="task-left">
                                          <button
                                            type="button"
                                            className={`task-checkbox-btn ${isCompleted ? 'checked' : ''}`}
                                            title={isCompleted ? 'Reopen task' : 'Mark task completed'}
                                            onClick={() => handleToggleTask(t)}
                                          >
                                            {isCompleted && <i className="bi bi-check" />}
                                          </button>
                                          <div>
                                            <div className="task-title">
                                              <i className={`bi ${TASK_TYPE_ICONS[t.type] || 'bi-check2-square'} me-1 text-secondary`} />
                                              {t.title}
                                            </div>
                                            <div className="task-meta">
                                              {isOverdue && (
                                                <span className="due-overdue">
                                                  <i className="bi bi-exclamation-circle-fill" /> Overdue ({new Date(t.dueDate).toLocaleDateString()})
                                                </span>
                                              )}
                                              {isToday && (
                                                <span className="due-today">
                                                  <i className="bi bi-clock-fill" /> Due today
                                                </span>
                                              )}
                                              {!isOverdue && !isToday && t.dueDate && (
                                                <span className="due-upcoming">
                                                  <i className="bi bi-calendar3" /> Due {new Date(t.dueDate).toLocaleDateString()}
                                                </span>
                                              )}
                                              <span className={`priority-${t.priority || 'medium'}`}>
                                                {t.priority}
                                              </span>
                                              {t.assignee && (
                                                <span>
                                                  <i className="bi bi-person me-1" />{t.assignee}
                                                </span>
                                              )}
                                              {t.notes && <span className="text-truncate" style={{ maxWidth: '240px' }}>“{t.notes}”</span>}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-1">
                                          <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm p-1"
                                            title="Edit task"
                                            onClick={() => {
                                              setEditingTaskId(t._id);
                                              setEditTaskForm({
                                                title: t.title,
                                                type: t.type || 'general',
                                                dueDate: t.dueDate ? t.dueDate.split('T')[0] : '',
                                                priority: t.priority || 'medium',
                                                status: t.status || 'pending',
                                                assignee: t.assignee || '',
                                                notes: t.notes || '',
                                              });
                                            }}
                                          >
                                            <i className="bi bi-pencil" />
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-outline-danger btn-sm p-1"
                                            title="Delete task"
                                            onClick={() => handleDeleteTask(t._id)}
                                          >
                                            <i className="bi bi-trash3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tab 4: Field Photographs & Visual History */}
                          {currentTab === 'photos' && (
                            <div className="field-operational-box">
                              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-2">
                                  <h5 className="mb-0 fs-6">Visual History ({fieldPhotos.length})</h5>
                                  {fieldPhotos.length > 0 && (
                                    <div className="btn-group btn-group-sm" role="group" aria-label="Visual history layout">
                                      <button
                                        type="button"
                                        className={`btn ${currentPhotoView === 'gallery' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                        title="Gallery Grid view"
                                        onClick={() => setPhotoViewMode((prev) => ({ ...prev, [field._id]: 'gallery' }))}
                                      >
                                        <i className="bi bi-grid me-1" /> Gallery
                                      </button>
                                      <button
                                        type="button"
                                        className={`btn ${currentPhotoView === 'timeline' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                        title="Chronological timeline view"
                                        onClick={() => setPhotoViewMode((prev) => ({ ...prev, [field._id]: 'timeline' }))}
                                      >
                                        <i className="bi bi-clock-history me-1" /> Timeline
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <button
                                  className="btn btn-primary btn-sm"
                                  type="button"
                                  onClick={() => openPhotoUpload(field._id, activeCycle?._id)}
                                >
                                  <i className="bi bi-cloud-arrow-up me-1" /> Upload photo
                                </button>
                              </div>

                              {isAddingPhoto && (
                                <form className="p-3 mb-3 bg-white border rounded" onSubmit={(e) => handlePhotoUploadSubmit(field._id, e)}>
                                  <h6 className="mb-2">Upload genuine field photograph for {field.name}</h6>
                                  <p className="text-muted small mb-3">
                                    Upload authentic visual documentation. Supported image formats: JPEG, PNG, WebP (max 10MB).
                                  </p>

                                  {photoError && (
                                    <div className="alert alert-danger py-2 small mb-3" role="alert">
                                      <i className="bi bi-exclamation-triangle-fill me-1" />
                                      {photoError}
                                    </div>
                                  )}

                                  <div className="mb-3">
                                    <label className="form-label small fw-semibold" htmlFor={`photo-file-${field._id}`}>
                                      Select Photograph *
                                    </label>
                                    <input
                                      id={`photo-file-${field._id}`}
                                      type="file"
                                      className="form-control form-control-sm"
                                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                      onChange={handlePhotoFileChange}
                                      required
                                    />
                                    {photoForm.file && (
                                      <div className="form-text text-success small mt-1">
                                        <i className="bi bi-check-circle me-1" />
                                        Selected: <strong>{photoForm.file.name}</strong> ({(photoForm.file.size / (1024 * 1024)).toFixed(2)} MB)
                                      </div>
                                    )}
                                  </div>

                                  <div className="row g-2 mb-3">
                                    <div className="col-12 col-md-6">
                                      <label className="form-label small fw-semibold" htmlFor={`photo-date-${field._id}`}>
                                        Date Captured *
                                      </label>
                                      <input
                                        id={`photo-date-${field._id}`}
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={photoForm.capturedAt}
                                        onChange={(e) => setPhotoForm((p) => ({ ...p, capturedAt: e.target.value }))}
                                        required
                                      />
                                    </div>

                                    <div className="col-12 col-md-6">
                                      <label className="form-label small fw-semibold" htmlFor={`photo-cycle-${field._id}`}>
                                        {t('farms.associatedCycleLabel')} <span className="text-muted fw-normal">({t('common.optional')})</span>
                                      </label>
                                      <select
                                        id={`photo-cycle-${field._id}`}
                                        className="form-select form-select-sm"
                                        value={photoForm.cropCycleId}
                                        onChange={(e) => setPhotoForm((p) => ({ ...p, cropCycleId: e.target.value }))}
                                      >
                                        <option value="">{t('farms.generalFieldPhoto')}</option>
                                        {fieldCycles.map((c) => (
                                          <option key={c._id} value={c._id}>
                                            {c.cropName} {c.variety ? `(${c.variety})` : ''} — {c.status} ({c.stage})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="mb-3">
                                    <label className="form-label small fw-semibold" htmlFor={`photo-notes-${field._id}`}>
                                      {t('farms.observationNotesLabel')} <span className="text-muted fw-normal">({t('common.optional')})</span>
                                    </label>
                                    <textarea
                                      id={`photo-notes-${field._id}`}
                                      className="form-control form-control-sm"
                                      rows="2"
                                      placeholder="Record observations, crop development stages, pest conditions, soil moisture, etc..."
                                      value={photoForm.notes}
                                      onChange={(e) => setPhotoForm((p) => ({ ...p, notes: e.target.value }))}
                                      maxLength={1000}
                                    />
                                  </div>

                                  <div className="d-flex gap-2">
                                    <button className="btn btn-primary btn-sm" type="submit" disabled={photoSaving}>
                                      {photoSaving ? (
                                        <>
                                          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                                          {t('common.saving')}
                                        </>
                                      ) : (
                                        <>
                                          <i className="bi bi-cloud-arrow-up me-1" />
                                          Upload photograph
                                        </>
                                      )}
                                    </button>
                                    <button
                                      className="btn btn-outline-secondary btn-sm"
                                      type="button"
                                      onClick={() => setPhotoFieldId(null)}
                                      disabled={photoSaving}
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  </div>
                                </form>
                              )}

                              {fieldPhotos.length === 0 ? (
                                <div className="p-4 text-center text-muted bg-light rounded border">
                                  <i className="bi bi-camera fs-1 mb-2 d-block text-secondary" aria-hidden="true" />
                                  <h5 className="fw-semibold text-dark">{t('farms.noPhotosYet')}</h5>
                                  <p className="small text-muted mb-3" style={{ maxWidth: '440px', margin: '0 auto' }}>
                                    Upload genuine field photographs to build an authentic visual record of crop stages, canopy development, and seasonal conditions over time.
                                  </p>
                                  <button
                                    type="button"
                                    className="btn btn-outline-success btn-sm"
                                    onClick={() => openPhotoUpload(field._id, activeCycle?._id)}
                                  >
                                    <i className="bi bi-cloud-arrow-up me-1" /> Upload first photograph
                                  </button>
                                </div>
                              ) : currentPhotoView === 'gallery' ? (
                                <div className="photo-gallery-grid">
                                  {fieldPhotos.map((photo) => {
                                    const linkedCycle = fieldCycles.find((c) => String(c._id) === String(photo.cropCycleId));
                                    return (
                                      <div key={photo._id} className="photo-card">
                                        <div
                                          className="photo-thumbnail-wrap"
                                          role="button"
                                          tabIndex={0}
                                          title="Click to view high-resolution image"
                                          onClick={() => setPreviewPhoto(photo)}
                                          onKeyDown={(e) => e.key === 'Enter' && setPreviewPhoto(photo)}
                                        >
                                          <AuthenticatedImage
                                            photoId={photo._id}
                                            alt={photo.originalFilename || 'Field photo'}
                                            className="photo-thumbnail-img"
                                          />
                                          {linkedCycle && (
                                            <span className="photo-overlay-badge">
                                              <i className="bi bi-sprout me-1" />
                                              {linkedCycle.cropName}
                                            </span>
                                          )}
                                        </div>
                                        <div className="photo-card-body">
                                          <div className="photo-card-date">
                                            <i className="bi bi-calendar3" aria-hidden="true" />
                                            {new Date(photo.capturedAt || photo.createdAt).toLocaleDateString()}
                                          </div>
                                          {photo.notes ? (
                                            <p className="photo-card-notes" title={photo.notes}>{photo.notes}</p>
                                          ) : (
                                            <p className="photo-card-notes text-muted fst-italic">{t('farms.noObservationNotes')}</p>
                                          )}
                                          <div className="photo-card-actions">
                                            <button
                                              type="button"
                                              className="btn btn-link text-decoration-none p-0 small text-success"
                                              onClick={() => setPreviewPhoto(photo)}
                                            >
                                              <i className="bi bi-arrows-fullscreen me-1" /> Preview
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-link text-decoration-none p-0 small text-danger"
                                              title="Delete photograph"
                                              onClick={() => handleDeletePhoto(photo._id || photo.id)}
                                              disabled={deletingPhotoId === (photo._id || photo.id)}
                                            >
                                              {deletingPhotoId === (photo._id || photo.id) ? 'Deleting…' : <i className="bi bi-trash3" />}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="photo-timeline">
                                  {fieldPhotos.map((photo) => {
                                    const linkedCycle = fieldCycles.find((c) => String(c._id) === String(photo.cropCycleId));
                                    return (
                                      <div key={photo._id} className="photo-timeline-entry">
                                        <div className="photo-timeline-dot" aria-hidden="true" />
                                        <div className="photo-timeline-content">
                                          <div
                                            className="photo-thumbnail-wrap photo-timeline-thumb"
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setPreviewPhoto(photo)}
                                            onKeyDown={(e) => e.key === 'Enter' && setPreviewPhoto(photo)}
                                            style={{ minHeight: '110px' }}
                                          >
                                            <AuthenticatedImage
                                              photoId={photo._id}
                                              alt={photo.originalFilename || 'Field photo'}
                                              className="photo-thumbnail-img"
                                            />
                                          </div>
                                          <div className="flex-grow-1">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                              <span className="fw-semibold text-dark small">
                                                <i className="bi bi-calendar3 me-1 text-success" />
                                                {new Date(photo.capturedAt || photo.createdAt).toLocaleDateString(undefined, {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                })}
                                              </span>
                                              {linkedCycle && (
                                                <Badge tone="sowing">
                                                  <i className="bi bi-sprout me-1" />
                                                  {linkedCycle.cropName}
                                                </Badge>
                                              )}
                                            </div>
                                            {photo.notes ? (
                                              <p className="small text-muted mb-2">{photo.notes}</p>
                                            ) : (
                                              <p className="small text-muted fst-italic mb-2">{t('farms.noObservationNotes')}</p>
                                            )}
                                            <div className="d-flex align-items-center gap-3">
                                              <button
                                                type="button"
                                                className="btn btn-link text-decoration-none p-0 small text-success"
                                                onClick={() => setPreviewPhoto(photo)}
                                              >
                                                <i className="bi bi-arrows-fullscreen me-1" /> Expand
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-link text-decoration-none p-0 small text-danger"
                                                onClick={() => handleDeletePhoto(photo._id || photo.id)}
                                                disabled={deletingPhotoId === (photo._id || photo.id)}
                                              >
                                                {deletingPhotoId === (photo._id || photo.id) ? 'Deleting…' : 'Delete'}
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon="bi-bounding-box"
                title={t('farms.noFieldsYet')}
                description={t('farms.addFieldsDesc')}
                action={<a className="btn btn-primary" href="#add-field">{t('farms.addFirstField')}</a>}
              />
            </Card>
          )}
        </div>

        <div className="col-12 col-xl-5">
          <Card className="form-card" id="add-field">
            <span className="eyebrow">{t('farms.eyebrow')}</span>
            <h2>{t('farms.quickAddField')}</h2>
            <form onSubmit={submitField}>
              <FormField
                id="field-name"
                label={t('farms.fieldNameLabel')}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={100}
                required
              />
              <FormField
                id="field-area"
                label={t('farms.fieldAreaLabel')}
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={form.areaHectares}
                onChange={(event) => setForm((current) => ({ ...current, areaHectares: event.target.value }))}
                required
              />
              <FormField
                id="field-soil"
                label={t('farms.soilTypeLabel')}
                optional
                value={form.soilType}
                onChange={(event) => setForm((current) => ({ ...current, soilType: event.target.value }))}
                maxLength={100}
              />
              <FormField
                id="field-water"
                label={t('farms.waterSourceLabel')}
                optional
                value={form.waterSource}
                onChange={(event) => setForm((current) => ({ ...current, waterSource: event.target.value }))}
                maxLength={100}
              />
              <FormField
                id="field-irrigation"
                label="Irrigation system / details"
                optional
                placeholder="e.g. Drip, Sprinkler, Furrow, Canal"
                value={form.irrigationDetails || ''}
                onChange={(event) => setForm((current) => ({ ...current, irrigationDetails: event.target.value }))}
                maxLength={100}
              />
              <button className="btn btn-primary w-100" type="submit" disabled={saving}>
                {saving ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />{t('common.saving')}</>
                ) : (
                  <><i className="bi bi-plus-lg me-2" aria-hidden="true" />{t('farms.quickAddField')}</>
                )}
              </button>
            </form>
          </Card>
        </div>
      </div>
      )}

      {/* Farm Profile Edit Modal */}
      <FarmModal
        isOpen={farmEditModalOpen}
        mode="edit"
        initialData={farm}
        onClose={() => setFarmEditModalOpen(false)}
        onSuccess={(savedFarm) => {
          setFarm(savedFarm);
          setNotice('Farm profile and agricultural properties updated.');
        }}
      />

      {previewPhoto && (
        <div
          className="photo-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Photograph preview"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewPhoto(null);
          }}
        >
          <div className="photo-lightbox-modal">
            <div className="photo-lightbox-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-camera text-success fs-5" aria-hidden="true" />
                <span className="fw-semibold text-dark">
                  Field Photograph — {new Date(previewPhoto.capturedAt || previewPhoto.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close image preview"
                onClick={() => setPreviewPhoto(null)}
              />
            </div>
            <div className="photo-lightbox-img-box">
              <AuthenticatedImage
                photoId={previewPhoto._id}
                alt={previewPhoto.originalFilename || 'Field photograph'}
                className="photo-lightbox-img"
              />
            </div>
            <div className="photo-lightbox-body">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-3 text-muted small">
                  <span>
                    <i className="bi bi-calendar3 me-1 text-success" />
                    Captured: <strong>{new Date(previewPhoto.capturedAt || previewPhoto.createdAt).toLocaleDateString()}</strong>
                  </span>
                  {previewPhoto.fileSize && (
                    <span>
                      <i className="bi bi-hdd me-1" />
                      {(previewPhoto.fileSize / (1024 * 1024)).toFixed(2)} MB ({previewPhoto.mimeType || 'image'})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => handleDeletePhoto(previewPhoto._id || previewPhoto.id)}
                  disabled={deletingPhotoId === (previewPhoto._id || previewPhoto.id)}
                >
                  <i className="bi bi-trash3 me-1" />
                  {deletingPhotoId === (previewPhoto._id || previewPhoto.id) ? 'Deleting…' : 'Delete photograph'}
                </button>
              </div>
              {previewPhoto.cropCycleId && (
                <div>
                  <span className="text-secondary small fw-semibold me-2">{t('farms.associatedCycleLabel')}</span>
                  <Badge tone="sowing">
                    {cropCycles.find((c) => String(c._id) === String(previewPhoto.cropCycleId))?.cropName || 'Crop Cycle'}
                  </Badge>
                </div>
              )}
              {previewPhoto.notes ? (
                <div className="p-2 bg-light rounded border small">
                  <span className="fw-semibold text-secondary d-block mb-1">{t('farms.observationNotesLabel')}</span>
                  {previewPhoto.notes}
                </div>
              ) : (
                <div className="text-muted small fst-italic">{t('farms.noObservationNotes')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default FarmDetailPage;
