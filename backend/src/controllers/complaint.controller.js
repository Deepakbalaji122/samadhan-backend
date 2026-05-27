import ComplaintModel from '../models/complaint.model.js';
import AuthorityModel from '../models/authority.model.js';
import { success, error } from '../utils/responseHelper.js';
import geocodingService from '../services/geocoding.service.js';

/**
 * Complaint Controller.
 */

/**
 * GET /api/complaints/categories
 * Get all available complaint sectors/categories.
 */
export async function getCategories(req, res, next) {
  try {
    const categories = ComplaintModel.getCategories();
    return success(res, categories, 'Categories fetched successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/complaints
 * Create a new complaint (citizen only).
 */
export async function createComplaint(req, res, next) {
  try {
    const { title, sector, description, location, latitude, longitude, priority } = req.body;

    console.log(`[DEBUG-ROUTING] Incoming complaint submission. Title: '${title}', Sector: '${sector}'`);

    let area = null;
    let pincode = null;
    let city = null;
    let village = null;
    let mandal = null;
    let district = null;

    if (latitude && longitude) {
      console.log(`[DEBUG-ROUTING] Reverse geocoding coordinates: ${latitude}, ${longitude}`);
      const geoResult = await geocodingService.reverseGeocode(latitude, longitude);
      if (geoResult) {
        area = geoResult.area;
        pincode = geoResult.pincode;
        city = geoResult.city;
        village = geoResult.village;
        mandal = geoResult.mandal;
        district = geoResult.district;
        console.log(`[DEBUG-ROUTING] Reverse geocoding successful. Area: ${area}, Pincode: ${pincode}, City: ${city}, Village: ${village}, Mandal: ${mandal}, District: ${district}`);
      } else {
        console.warn(`[DEBUG-ROUTING] Reverse geocoding failed or returned null for ${latitude}, ${longitude}`);
      }
    }

    // Get image path if uploaded
    const image_path = req.file ? `/uploads/complaints/${req.file.filename}` : null;

    const complaint = ComplaintModel.create({
      title,
      sector,
      citizen_id: req.user.id,
      description,
      image_path,
      location,
      latitude,
      longitude,
      area,
      pincode,
      city,
      village,
      mandal,
      district,
      priority,
    });

    console.log(`[DEBUG-ROUTING] Complaint successfully stored in DB. ID: ${complaint.id}, Sector: '${complaint.sector}'`);

    return success(res, { complaint }, 'Complaint submitted successfully.', 201);
  } catch (err) {
    console.error("[DEBUG-ROUTING] Error creating complaint:", err);
    next(err);
  }
}

/**
 * GET /api/complaints/sector
 * Get complaints automatically routed to the logged-in authority's sector.
 */
export async function getSectorComplaints(req, res, next) {
  try {
    const { status, priority, page, limit } = req.query;

    // Fetch authority details to get their assigned sector
    const authority = AuthorityModel.findById(req.user.id);
    if (!authority) {
      console.warn(`[DEBUG-ROUTING] Authority profile not found for user ID: ${req.user.id}`);
      return error(res, 'Authority profile not found.', 404);
    }

    console.log(`[DEBUG-ROUTING] Fetching complaints for Authority ID: ${authority.id}, Assigned Sector: '${authority.sector}', Area: '${authority.area}', Pincode: '${authority.pincode}'`);

    const result = ComplaintModel.findBySector(authority.sector, authority.area, authority.pincode, {
      status,
      priority,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    console.log(`[DEBUG-ROUTING] Found ${result.complaints.length} complaints matching sector '${authority.sector}'`);

    return success(res, result, `Complaints for sector '${authority.sector}' fetched successfully.`);
  } catch (err) {
    console.error("[DEBUG-ROUTING] Error in getSectorComplaints:", err);
    next(err);
  }
}

/**
 * GET /api/complaints
 * Get all complaints with optional filters (authority/admin).
 */
export async function getComplaints(req, res, next) {
  try {
    const { status, priority, page, limit } = req.query;

    const result = ComplaintModel.findAll({
      status,
      priority,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    return success(res, result, 'Complaints fetched successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints/my-reports
 * Get complaints raised by the logged-in citizen.
 */
export async function getMyReports(req, res, next) {
  try {
    const { page, limit } = req.query;

    const result = ComplaintModel.findByCitizenId(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    return success(res, result, 'Your reports fetched successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints/assigned
 * Get complaints explicitly assigned to the logged-in authority.
 */
export async function getAssignedComplaints(req, res, next) {
  try {
    const { page, limit } = req.query;

    const result = ComplaintModel.findByAuthorityId(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    return success(res, result, 'Assigned complaints fetched successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints/nearby
 * Get complaints near a location.
 */
export async function getNearbyComplaints(req, res, next) {
  try {
    const { latitude, longitude, radius, page, limit } = req.query;

    if (!latitude || !longitude) {
      return error(res, 'Latitude and longitude are required.', 400);
    }

    const result = ComplaintModel.findNearby({
      latitude,
      longitude,
      radiusKm: parseFloat(radius) || 5,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    return success(res, result, 'Nearby complaints fetched successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/complaints/:id
 * Get a single complaint by ID with sector-based authorization.
 */
export async function getComplaintById(req, res, next) {
  try {
    const complaint = ComplaintModel.findById(parseInt(req.params.id));

    if (!complaint) {
      return error(res, 'Complaint not found.', 404);
    }

    // Role-based Sector Authorization Logic: If the requester is an authority, verify sector alignment
    if (req.user && req.user.role === 'authority') {
      const authority = AuthorityModel.findById(req.user.id);
      if (!authority || authority.sector !== complaint.sector) {
        return error(
          res,
          `Access Denied: Unrelated Department. Complaint belongs to '${complaint.sector}' sector. You are authorized only for '${authority ? authority.sector : 'Unknown'}' sector.`,
          403
        );
      }
    }

    // Also get status history
    const history = ComplaintModel.getStatusHistory(complaint.id);

    return success(res, { complaint, history }, 'Complaint fetched successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/complaints/:id/status
 * Update complaint status with resolution/remarks (authority/admin).
 */
export async function updateStatus(req, res, next) {
  try {
    const complaintId = parseInt(req.params.id);

    console.log(`[STATUS-UPDATE] ═══ Request received for complaint #${complaintId} ═══`);
    console.log(`[STATUS-UPDATE] req.body:`, JSON.stringify(req.body));
    console.log(`[STATUS-UPDATE] req.file:`, req.file ? { filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size } : 'NO FILE');
    console.log(`[STATUS-UPDATE] req.user:`, JSON.stringify(req.user));

    const { status, remarks, latitude, longitude } = req.body;
    const resolution_photo = req.file ? `/uploads/complaints/${req.file.filename}` : null;

    console.log(`[STATUS-UPDATE] Parsed values — status: '${status}', remarks: '${remarks}', lat: '${latitude}', lng: '${longitude}', photo: '${resolution_photo}'`);

    // Check if complaint exists
    const existing = ComplaintModel.findById(complaintId);
    if (!existing) {
      return error(res, 'Complaint not found.', 404);
    }

    // Enforce sector checking if authority updates status
    if (req.user && req.user.role === 'authority') {
      const authority = AuthorityModel.findById(req.user.id);
      if (!authority || authority.sector !== existing.sector) {
        return error(res, `Cannot update status: Complaint belongs to '${existing.sector}' sector.`, 403);
      }
    }

    try {
      const updated = ComplaintModel.updateStatus(complaintId, {
        status,
        changed_by_role: req.user.role,
        changed_by_id: req.user.id,
        remarks,
        latitude,
        longitude,
        resolution_photo
      });

      console.log(`[STATUS-UPDATE] ✅ Success — complaint #${complaintId} updated to '${status}'`);
      return success(res, { complaint: updated }, 'Complaint status/resolution updated successfully.');
    } catch (modelErr) {
      console.error(`[STATUS-UPDATE] ❌ Model error:`, modelErr.message);
      return error(res, modelErr.message, 400);
    }
  } catch (err) {
    console.error(`[STATUS-UPDATE] ❌ Unexpected error:`, err);
    next(err);
  }
}

/**
 * PUT /api/complaints/:id/begin
 * Begin processing a complaint (authority only).
 * Transitions status from Pending → In Progress with GPS + timestamp.
 */
export async function beginProcess(req, res, next) {
  try {
    const complaintId = parseInt(req.params.id);
    const { latitude, longitude, notes } = req.body;

    console.log(`[BEGIN-PROCESS] Request for complaint #${complaintId}`);
    console.log(`[BEGIN-PROCESS] Body:`, JSON.stringify(req.body));

    // Check if complaint exists
    const existing = ComplaintModel.findById(complaintId);
    if (!existing) {
      return error(res, 'Complaint not found.', 404);
    }

    // Enforce sector checking
    if (req.user && req.user.role === 'authority') {
      const authority = AuthorityModel.findById(req.user.id);
      if (!authority || authority.sector !== existing.sector) {
        return error(res, `Cannot begin process: Complaint belongs to '${existing.sector}' sector.`, 403);
      }
    }

    try {
      const updated = ComplaintModel.beginProcess(complaintId, {
        authority_id: req.user.id,
        latitude,
        longitude,
        notes,
      });

      console.log(`[BEGIN-PROCESS] ✅ Complaint #${complaintId} now In Progress`);
      return success(res, { complaint: updated }, 'Complaint processing started successfully.');
    } catch (modelErr) {
      console.error(`[BEGIN-PROCESS] ❌ Model error:`, modelErr.message);
      return error(res, modelErr.message, 400);
    }
  } catch (err) {
    console.error(`[BEGIN-PROCESS] ❌ Unexpected error:`, err);
    next(err);
  }
}

/**
 * PUT /api/complaints/:id/assign
 * Assign an authority to a complaint (admin only).
 */
export async function assignAuthority(req, res, next) {
  try {
    const { authority_id } = req.body;
    const complaintId = parseInt(req.params.id);

    // Check if complaint exists
    const existing = ComplaintModel.findById(complaintId);
    if (!existing) {
      return error(res, 'Complaint not found.', 404);
    }

    const updated = ComplaintModel.assignAuthority(complaintId, parseInt(authority_id));

    return success(res, { complaint: updated }, 'Authority assigned successfully.');
  } catch (err) {
    next(err);
  }
}
