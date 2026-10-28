import express from 'express';

import { requireRole } from '../middleware/session.js';
import * as service from '../services/markerService.js';
import { safeUnlinkAll } from '../services/fileService.js';
import { parseId } from '../validation.js';

const router = express.Router();

/**
 * Delete a single review; its media rows cascade and its files are unlinked.
 * An admin may delete any review, a reviewer only their own; the service does
 * that check, because it already has the row loaded.
 */
router.delete('/:id', requireRole('reviewer', 'admin'), async (req, res) => {
  const id = parseId(req.params.id, 'review id');
  const { paths } = service.deleteReview(id, req.user);
  await safeUnlinkAll(paths);
  res.status(204).end();
});

export default router;
