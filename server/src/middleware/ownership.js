/**
 * Ownership verification middleware.
 * Verifies that the authenticated user either owns the resource (by ID matching req.user.id)
 * or possesses an elevated role (e.g. 'admin').
 */
export const checkUserOwnership = (paramName = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required for ownership verification.'
      });
    }

    const targetId = req.params[paramName];
    const requestingUserId = (req.user._id || req.user.id)?.toString();

    // Admins bypass ownership checks
    if (req.user.role === 'admin') {
      return next();
    }

    if (!targetId || targetId !== requestingUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: You do not have permission to modify or access this resource.'
      });
    }

    next();
  };
};

/**
 * Higher-order middleware to verify resource owner against a generic getter.
 * @param {Function} resourceGetter - async (id) => resource object with .userId or .ownerId
 * @param {string} paramName - Name of the route parameter containing resource ID
 */
export const checkResourceOwner = (resourceGetter, paramName = 'id') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required for resource access.'
      });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const resourceId = req.params[paramName];
      const resource = await resourceGetter(resourceId);

      if (!resource) {
        return res.status(404).json({ error: 'Not Found', message: 'Resource not found' });
      }

      const resourceOwnerId = (resource.ownerId || resource.userId || resource.user)?.toString();
      const currentUserId = (req.user._id || req.user.id)?.toString();

      if (resourceOwnerId !== currentUserId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: You are not the owner of this agricultural resource.'
        });
      }

      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
};

export default { checkUserOwnership, checkResourceOwner };
