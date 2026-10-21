export const ownedUserFilter = (userId, requesterId, isAdmin = false) => ({
  $and: [
    { _id: userId },
    ...(isAdmin ? [] : [{ _id: requesterId }]),
  ],
});

export const ownedResourceFilter = (resourceId, ownerId) => ({
  _id: resourceId,
  ownerId,
});
