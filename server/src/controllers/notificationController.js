import { farmStore as defaultFarmStore } from '../storage/farmStore.js';

export const createNotificationController = (farmStore = defaultFarmStore) => ({
  async listNotifications(req, res, next) {
    try {
      const notifications = await farmStore.listNotifications(req.user._id, req.query.limit || 50);
      const unreadCount = notifications.filter((n) => !n.read).length;
      return res.status(200).json({
        success: true,
        count: notifications.length,
        unreadCount,
        data: notifications,
      });
    } catch (err) {
      return next(err);
    }
  },

  async markRead(req, res, next) {
    try {
      const updated = await farmStore.markNotificationRead(req.user._id, req.params.id);
      if (!updated) {
        return res.status(404).json({ error: 'Not Found', message: 'Notification not found.' });
      }
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      return next(err);
    }
  },

  async markAllRead(req, res, next) {
    try {
      await farmStore.markAllNotificationsRead(req.user._id);
      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read.',
      });
    } catch (err) {
      return next(err);
    }
  },
});

export default createNotificationController();
