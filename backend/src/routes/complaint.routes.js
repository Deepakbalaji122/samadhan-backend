import { Router } from 'express';
import {
  getCategories,
  createComplaint,
  getSectorComplaints,
  getComplaints,
  getMyReports,
  getAssignedComplaints,
  getNearbyComplaints,
  getComplaintById,
  updateStatus,
  beginProcess,
  assignAuthority,
} from '../controllers/complaint.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadComplaint } from '../middleware/upload.js';
import { validateCreateComplaint, validateStatusUpdate, validateBeginProcess, validateAssignment } from '../validators/complaint.validator.js';

const router = Router();

// All complaint routes require authentication
router.use(authenticate);

// Public/Shared category info route
router.get('/categories', getCategories);

// Citizen routes
router.post('/', authorize('citizen'), uploadComplaint.single('image'), validate(validateCreateComplaint), createComplaint);
router.get('/my-reports', authorize('citizen'), getMyReports);

// Authority routes: Smart routing queries
router.get('/sector', authorize('authority'), getSectorComplaints);
router.get('/assigned', authorize('authority'), getAssignedComplaints);

// Shared routes (citizen can see nearby, authority/admin can see all)
router.get('/nearby', authorize('citizen', 'authority', 'admin'), getNearbyComplaints);
router.get('/', authorize('authority', 'admin'), getComplaints);

// Single complaint (any authenticated user)
router.get('/:id', getComplaintById);

// Begin processing (authority only)
router.put('/:id/begin', authorize('authority'), validate(validateBeginProcess), beginProcess);

// Status update (authority/admin)
router.put('/:id/status', authorize('authority', 'admin'), uploadComplaint.single('resolution_photo'), validate(validateStatusUpdate), updateStatus);

// Assignment (admin only)
router.put('/:id/assign', authorize('admin'), validate(validateAssignment), assignAuthority);

export default router;
