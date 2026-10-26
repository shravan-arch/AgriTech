import { Router } from 'express';
import { createFarmController } from '../controllers/farmController.js';
import { createProtect, restrictAdminFromAgriculturalWrites } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createFarmRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore,
  customPhotoStorage
) => {
  const router = Router();
  const controller = createFarmController(farmStore, customPhotoStorage);
  const protect = createProtect(userStore);

  router.use(protect);
  router.route('/')
    .get(controller.listFarms)
    .post(controller.createFarm);
  router.route('/crop-cycles')
    .get(controller.listAllCropCycles);
  router.route('/crop-cycles/:cycleId')
    .get(controller.getCropCycle)
    .patch(controller.updateCropCycle)
    .delete(controller.deleteCropCycle);
  router.route('/activities')
    .get(controller.listActivities)
    .post(controller.createActivity);
  router.route('/activities/:activityId')
    .get(controller.getActivity)
    .patch(controller.updateActivity)
    .delete(controller.deleteActivity);
  router.route('/tasks')
    .get(controller.listTasks)
    .post(controller.createTask);
  router.route('/tasks/:taskId')
    .get(controller.getTask)
    .patch(controller.updateTask)
    .delete(controller.deleteTask);
  router.route('/tasks/:taskId/complete')
    .post(controller.completeTask);

  // Field photographs root endpoints (before /:farmId)
  router.route('/photos')
    .get(controller.listPhotos)
    .post(controller.photoUploadMiddleware, controller.uploadPhoto);
  router.route('/photos/:photoId')
    .get(controller.getPhoto)
    .patch(controller.updatePhoto)
    .delete(controller.deletePhoto);
  router.route('/photos/:photoId/file')
    .get(controller.getPhotoFile);

  // Fields root endpoints
  router.route('/fields')
    .get(controller.listAllFields);
  router.route('/fields/:fieldId')
    .get(controller.getField)
    .patch(controller.updateField)
    .delete(controller.deleteField);
  router.route('/:farmId')
    .get(controller.getFarm)
    .patch(controller.updateFarm)
    .delete(controller.deleteFarm);
  router.route('/:farmId/fields')
    .get(controller.listFields)
    .post(controller.createField);
  router.route('/:farmId/fields/:fieldId')
    .get(controller.getField)
    .patch(controller.updateField)
    .delete(controller.deleteField);
  router.route('/:farmId/fields/:fieldId/crop-cycles')
    .get(controller.listFieldCropCycles)
    .post(controller.createCropCycle);
  router.route('/:farmId/fields/:fieldId/crop-cycles/:cycleId')
    .get(controller.getCropCycle)
    .patch(controller.updateCropCycle)
    .delete(controller.deleteCropCycle);
  router.route('/:farmId/fields/:fieldId/activities')
    .get(controller.listFieldActivities)
    .post(controller.createActivity);
  router.route('/:farmId/fields/:fieldId/activities/:activityId')
    .get(controller.getActivity)
    .patch(controller.updateActivity)
    .delete(controller.deleteActivity);

  // Nested field photo endpoints
  router.route('/:farmId/fields/:fieldId/photos')
    .get(controller.listFieldPhotos)
    .post(controller.photoUploadMiddleware, controller.uploadPhoto);
  router.route('/:farmId/fields/:fieldId/photos/:photoId')
    .get(controller.getPhoto)
    .patch(controller.updatePhoto)
    .delete(controller.deletePhoto);
  router.route('/:farmId/fields/:fieldId/photos/:photoId/file')
    .get(controller.getPhotoFile);

  return router;
};

export default createFarmRouter();
