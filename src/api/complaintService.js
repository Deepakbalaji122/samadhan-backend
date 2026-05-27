import api from './axiosInstance';

// ═══════════════════════════════════════════════════════════════
//  COMPLAINT API SERVICES
// ═══════════════════════════════════════════════════════════════

/**
 * Get all available complaint sectors/categories.
 */
export const getCategories = async () => {
  const response = await api.get('/complaints/categories');
  return response.data;
};

/**
 * Get complaints automatically routed to the logged-in authority's sector.
 * @param {number} page
 * @param {number} limit
 */
export const getSectorComplaints = async (page = 1, limit = 20) => {
  const response = await api.get('/complaints/sector', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Create a new complaint (citizen only).
 * @param {FormData} formData - Must include: title, sector, description, location. Optional: image (file), latitude, longitude, priority
 */
export const createComplaint = async (formData) => {
  const response = await api.post('/complaints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Get complaints raised by the logged-in citizen.
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 */
export const getMyReports = async (page = 1, limit = 20) => {
  const response = await api.get('/complaints/my-reports', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Get complaints assigned to the logged-in authority.
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 */
export const getAssignedComplaints = async (page = 1, limit = 20) => {
  const response = await api.get('/complaints/assigned', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Get complaints near a location.
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} radius - Radius in km (default: 5)
 * @param {number} page
 * @param {number} limit
 */
export const getNearbyComplaints = async (latitude, longitude, radius = 5, page = 1, limit = 20) => {
  const response = await api.get('/complaints/nearby', {
    params: { latitude, longitude, radius, page, limit },
  });
  return response.data;
};

/**
 * Get all complaints with optional filters (authority/admin).
 * @param {Object} filters - { status, priority, page, limit }
 */
export const getAllComplaints = async (filters = {}) => {
  const response = await api.get('/complaints', {
    params: {
      status: filters.status,
      priority: filters.priority,
      page: filters.page || 1,
      limit: filters.limit || 20,
    },
  });
  return response.data;
};

/**
 * Get a single complaint by ID.
 * @param {number} id - Complaint ID
 */
export const getComplaintById = async (id) => {
  const response = await api.get(`/complaints/${id}`);
  return response.data;
};

/**
 * Begin processing a complaint (authority only).
 * Transitions status from Pending → In Progress with GPS + timestamp.
 * @param {number} id - Complaint ID
 * @param {Object} data - { latitude, longitude, notes }
 */
export const beginProcessComplaint = async (id, data = {}) => {
  console.log(`[API] beginProcessComplaint — ID: ${id}, Data:`, data);
  const response = await api.put(`/complaints/${id}/begin`, {
    latitude: data.latitude ? String(data.latitude) : null,
    longitude: data.longitude ? String(data.longitude) : null,
    notes: data.notes || '',
  });
  return response.data;
};

/**
 * Update complaint status (authority/admin).
 * @param {number} id - Complaint ID
 * @param {string} status - New status
 * @param {string} remarks - Optional remarks
 * @param {File} file - Optional resolution photo
 * @param {Object} locationCoords - Optional { latitude, longitude }
 */
export const updateComplaintStatus = async (id, status, remarks = '', file = null, locationCoords = null) => {
  console.log(`[API] updateComplaintStatus — ID: ${id}, Status: '${status}', File: ${file ? file.name : 'none'}, Coords:`, locationCoords);

  if (status.toLowerCase() === 'resolved' && file && locationCoords) {
    const formData = new FormData();
    formData.append('status', status);
    formData.append('remarks', remarks);
    formData.append('latitude', String(locationCoords.latitude));
    formData.append('longitude', String(locationCoords.longitude));
    formData.append('resolution_photo', file);

    // Debug: log all FormData entries
    console.log('[API] FormData entries:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value instanceof File ? `File(${value.name}, ${value.size}b)` : value}`);
    }

    const response = await api.put(`/complaints/${id}/status`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } else {
    const response = await api.put(`/complaints/${id}/status`, { status, remarks });
    return response.data;
  }
};

/**
 * Assign an authority to a complaint (admin only).
 * @param {number} id - Complaint ID
 * @param {number} authority_id - Authority user ID
 */
export const assignAuthority = async (id, authority_id) => {
  const response = await api.put(`/complaints/${id}/assign`, { authority_id });
  return response.data;
};
