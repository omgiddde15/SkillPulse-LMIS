/**
 * SkillPulse LMIS API Client Module
 *
 * Uses relative paths (/api/v1/..., /health) to route through Vite proxy during development.
 * Strictly adheres to backend schemas without hardcoded fallbacks or simulated data.
 */

async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson && errorJson.detail) {
          detail = Array.isArray(errorJson.detail)
            ? errorJson.detail.map(d => d.msg || JSON.stringify(d)).join(', ')
            : errorJson.detail;
        }
      } catch {
        // Ignore json parse error and keep statusText
      }
      throw new Error(detail);
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Unable to reach SkillPulse backend server. Please verify FastAPI is running at http://127.0.0.1:8000.');
    }
    throw err;
  }
}

/**
 * Health Check Endpoint
 * @returns {Promise<{ status: string }>}
 */
export async function fetchHealth() {
  return request('/health');
}

/**
 * Fetch Reference Metadata & Taxonomy
 * @returns {Promise<Object>}
 */
export async function fetchMetadata() {
  return request('/api/v1/metadata');
}

/**
 * Fetch Demand Index Results
 * @param {Object} params Query parameters
 * @param {string} [params.period] Monthly period (YYYY-MM)
 * @param {string} [params.state_code] State code (KA, MH, TS)
 * @param {string} [params.district_id] District code
 * @param {string} [params.sector] Sector name
 * @param {number} [params.limit] Max items to return
 * @returns {Promise<Object>}
 */
export async function fetchDemandIndex(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set('period', params.period);
  if (params.state_code) query.set('state_code', params.state_code);
  if (params.district_id) query.set('district_id', params.district_id);
  if (params.sector) query.set('sector', params.sector);
  if (params.limit !== undefined && params.limit !== null) query.set('limit', params.limit);

  const qs = query.toString();
  const endpoint = qs ? `/api/v1/demand-index?${qs}` : '/api/v1/demand-index';
  return request(endpoint);
}

/**
 * Fetch Gap Analysis & Relative Mismatch Results
 * @param {Object} params Query parameters
 * @param {string} [params.period] Monthly period (YYYY-MM)
 * @param {string} [params.state_code] State code
 * @param {string} [params.district_id] District code
 * @param {string} [params.sector] Sector name
 * @param {string} [params.classification] Classification filter
 * @param {number} [params.limit] Max items to return
 * @returns {Promise<Object>}
 */
export async function fetchGapAnalysis(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set('period', params.period);
  if (params.state_code) query.set('state_code', params.state_code);
  if (params.district_id) query.set('district_id', params.district_id);
  if (params.sector) query.set('sector', params.sector);
  if (params.classification) query.set('classification', params.classification);
  if (params.limit !== undefined && params.limit !== null) query.set('limit', params.limit);

  const qs = query.toString();
  const endpoint = qs ? `/api/v1/gap-analysis?${qs}` : '/api/v1/gap-analysis';
  return request(endpoint);
}

/**
 * Fetch Forecasts (for subsequent tabs / preview)
 */
export async function fetchForecasts(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set('period', params.period);
  if (params.horizon) query.set('horizon', params.horizon);
  if (params.state_code) query.set('state_code', params.state_code);
  if (params.district_id) query.set('district_id', params.district_id);
  if (params.sector) query.set('sector', params.sector);
  if (params.limit !== undefined && params.limit !== null) query.set('limit', params.limit);

  const qs = query.toString();
  const endpoint = qs ? `/api/v1/forecasts?${qs}` : '/api/v1/forecasts';
  return request(endpoint);
}

/**
 * Fetch Early Warning Alerts (for subsequent tabs / preview)
 */
export async function fetchAlerts(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set('period', params.period);
  if (params.severity) query.set('severity', params.severity);
  if (params.alert_type) query.set('alert_type', params.alert_type);
  if (params.horizon) query.set('horizon', params.horizon);
  if (params.state_code) query.set('state_code', params.state_code);
  if (params.district_id) query.set('district_id', params.district_id);
  if (params.sector) query.set('sector', params.sector);
  if (params.limit !== undefined && params.limit !== null) query.set('limit', params.limit);

  const qs = query.toString();
  const endpoint = qs ? `/api/v1/alerts?${qs}` : '/api/v1/alerts';
  return request(endpoint);
}

/**
 * Submit Training-Seat Allocation Simulation Scenario
 * @param {Object} payload Simulation parameters
 * @param {string} payload.period Base reporting period (YYYY-MM)
 * @param {number} payload.horizon_months Forecast horizon (3, 6, 12)
 * @param {string} payload.district_id District identifier
 * @param {string} payload.occupation_id Occupation identifier
 * @param {number} payload.proposed_seats_per_cohort Proposed seats per cohort (1-5000)
 * @param {number} [payload.posting_to_opening_multiplier] Assumed multiplier (k) converting postings to openings (0.5-1.5)
 * @param {number} [payload.local_availability_factor] Assumed share (alpha) of certified throughput available locally (0.4-1.0)
 * @returns {Promise<Object>}
 */
export async function postSeatAllocation(payload) {
  return request('/api/v1/simulations/seat-allocation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Register a new user account
 * @param {Object} data { email, full_name, password, confirm_password }
 */
export async function registerUser(data) {
  return request('/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Log in an existing user
 * @param {Object} data { email, password, remember_me }
 */
export async function loginUser(data) {
  return request('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Restore current session profile on load/refresh
 */
export async function fetchCurrentUser() {
  return request('/api/v1/auth/me');
}

/**
 * Invalidate server session and log out
 */
export async function logoutUser() {
  return request('/api/v1/auth/logout', {
    method: 'POST',
  });
}

/**
 * List saved Seat Simulator scenarios for authenticated user
 */
export async function fetchSavedScenarios() {
  return request('/api/v1/scenarios');
}

/**
 * Save Seat Simulator scenario for authenticated user
 */
export async function createSavedScenario(payload) {
  return request('/api/v1/scenarios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Get single saved scenario detail
 */
export async function fetchScenarioDetail(scenarioId) {
  return request(`/api/v1/scenarios/${scenarioId}`);
}

/**
 * Delete saved scenario by ID
 */
export async function deleteSavedScenario(scenarioId) {
  return request(`/api/v1/scenarios/${scenarioId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch authenticated user's career profile
 * @returns {Promise<{ has_profile: boolean, profile: Object|null }>}
 */
export async function fetchCareerProfile() {
  return request('/api/v1/career/profile');
}

/**
 * Create or update user's career profile
 * @param {Object} profileData
 * @returns {Promise<{ status: string, message: string, profile: Object }>}
 */
export async function saveCareerProfile(profileData) {
  return request('/api/v1/career/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });
}

/**
 * Upload a text-based PDF resume
 * @param {File} file
 * @returns {Promise<{ status: string, message: string, resume: Object }>}
 */
export async function uploadResumeFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/v1/career/resume', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Fetch authenticated user's latest resume metadata and parsed content
 * @returns {Promise<{ has_resume: boolean, resume: Object|null }>}
 */
export async function fetchLatestResume() {
  return request('/api/v1/career/resume/latest');
}

/**
 * Submit user-confirmed or corrected parsed resume data
 * @param {number} resumeId
 * @param {Object} parsedData
 * @returns {Promise<{ status: string, message: string, resume: Object }>}
 */
export async function reviewResumeParsedData(resumeId, parsedData) {
  return request(`/api/v1/career/resume/${resumeId}/review`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parsedData),
  });
}

/**
 * Delete a resume from server storage and database
 * @param {number} resumeId
 * @returns {Promise<{ status: string, message: string }>}
 */
export async function deleteResume(resumeId) {
  return request(`/api/v1/career/resume/${resumeId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch authenticated user's confirmed/claimed/evidenced skills
 * @returns {Promise<{ total_skills: number, verified_skills_count: number, skills: Array }>}
 */
export async function fetchUserSkills() {
  return request('/api/v1/career/skills');
}

/**
 * Add a new user-claimed or user-evidenced skill
 * @param {Object} skillData
 * @returns {Promise<{ status: string, message: string, skill: Object }>}
 */
export async function addUserSkill(skillData) {
  return request('/api/v1/career/skills', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(skillData),
  });
}

/**
 * Update an existing user skill (evidence status, source context, etc.)
 * @param {number} skillId
 * @param {Object} updateData
 * @returns {Promise<{ status: string, message: string, skill: Object }>}
 */
export async function updateUserSkill(skillId, updateData) {
  return request(`/api/v1/career/skills/${skillId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });
}

/**
 * Delete a user skill record
 * @param {number} skillId
 * @returns {Promise<{ status: string, message: string }>}
 */
export async function deleteUserSkill(skillId) {
  return request(`/api/v1/career/skills/${skillId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch list of supported benchmark target roles with skill profiles
 * @returns {Promise<{ total_roles: number, roles: Array }>}
 */
export async function fetchSupportedRoles() {
  return request('/api/v1/career/roles');
}

/**
 * Fetch full profile and requirements for a target role
 * @param {string} roleId
 * @returns {Promise<Object>}
 */
export async function fetchRoleDetails(roleId) {
  return request(`/api/v1/career/roles/${roleId}`);
}

/**
 * Deterministically compute candidate skill-gap analysis against target role
 * @param {string} roleId
 * @returns {Promise<Object>}
 */
export async function fetchSkillGapAnalysis(roleId) {
  return request(`/api/v1/career/skill-gaps?role_id=${encodeURIComponent(roleId)}`);
}

/**
 * Fetch list of registered trusted official source directories
 * @returns {Promise<{ status: string, count: number, sources: Array }>}
 */
export async function fetchOpportunitySources() {
  return request('/api/v1/career/sources');
}

/**
 * Search and filter opportunities and portal directories
 * @param {Object} params
 * @returns {Promise<{ status: string, total: number, count: number, items: Array }>}
 */
export async function fetchOpportunities(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, String(val));
    }
  });
  const qs = query.toString();
  return request(`/api/v1/career/opportunities${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch single opportunity or portal directory by ID
 * @param {string} opportunityId
 * @returns {Promise<{ status: string, opportunity: Object }>}
 */
export async function fetchOpportunityDetails(opportunityId) {
  return request(`/api/v1/career/opportunities/${encodeURIComponent(opportunityId)}`);
}

/**
 * Fetch personalized recommendations for the authenticated candidate
 * @param {string} [roleId]
 * @returns {Promise<Object>}
 */
export async function fetchOpportunityRecommendations(roleId = null) {
  const qs = roleId ? `?target_role_id=${encodeURIComponent(roleId)}` : '';
  return request(`/api/v1/career/recommendations${qs}`);
}

/**
 * Generate a personalized or deterministic career roadmap
 * @param {Object} payload
 * @param {string} payload.target_role_id
 * @param {number} [payload.horizon_days]
 * @param {string} [payload.client_request_token]
 * @returns {Promise<Object>}
 */
export async function generateCareerRoadmap(payload) {
  return request('/api/v1/career/roadmaps/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch list of saved career roadmaps for authenticated user
 * @returns {Promise<{ status: string, count: number, roadmaps: Array }>}
 */
export async function fetchCareerRoadmaps() {
  return request('/api/v1/career/roadmaps');
}

/**
 * Fetch complete details of a specific saved roadmap
 * @param {number|string} roadmapId
 * @returns {Promise<Object>}
 */
export async function fetchCareerRoadmapDetails(roadmapId) {
  return request(`/api/v1/career/roadmaps/${encodeURIComponent(roadmapId)}`);
}

/**
 * Delete a saved career roadmap
 * @param {number|string} roadmapId
 * @returns {Promise<{ status: string, message: string }>}
 */
export async function deleteCareerRoadmap(roadmapId) {
  return request(`/api/v1/career/roadmaps/${encodeURIComponent(roadmapId)}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle or update completion status of a roadmap milestone
 * @param {number|string} roadmapId
 * @param {number|string} milestoneId
 * @param {boolean} isCompleted
 * @returns {Promise<{ status: string, milestone: Object }>}
 */
export async function updateRoadmapMilestoneStatus(roadmapId, milestoneId, isCompleted) {
  return request(`/api/v1/career/roadmaps/${encodeURIComponent(roadmapId)}/milestones/${encodeURIComponent(milestoneId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_completed: isCompleted }),
  });
}

// ============================================================================
// Phase 5: Application Tracker API
// ============================================================================

/**
 * Fetch candidate's tracked applications, optionally filtered by stage
 * @param {string} [stage]
 * @returns {Promise<{ count: number, items: Array }>}
 */
export async function fetchTrackedApplications(stage = null) {
  const qs = stage ? `?stage=${encodeURIComponent(stage)}` : '';
  return request(`/api/v1/career/tracker${qs}`);
}

/**
 * Fetch detail of a single tracked application
 * @param {number|string} trackerId
 * @returns {Promise<Object>}
 */
export async function fetchTrackedApplicationDetails(trackerId) {
  return request(`/api/v1/career/tracker/${encodeURIComponent(trackerId)}`);
}

/**
 * Track a catalogue opportunity or add an external application
 * @param {Object} payload
 * @param {string} [payload.opportunity_id]
 * @param {string} [payload.custom_title]
 * @param {string} [payload.custom_organization]
 * @param {string} [payload.stage]
 * @param {string} [payload.date_applied]
 * @param {string} [payload.notes]
 * @returns {Promise<Object>}
 */
export async function createTrackedApplication(payload) {
  return request('/api/v1/career/tracker', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Update stage, dates, or notes of a tracked application
 * @param {number|string} trackerId
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function updateTrackedApplication(trackerId, payload) {
  return request(`/api/v1/career/tracker/${encodeURIComponent(trackerId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Remove an opportunity from the application tracker
 * @param {number|string} trackerId
 * @returns {Promise<{ status: string, message: string }>}
 */
export async function deleteTrackedApplication(trackerId) {
  return request(`/api/v1/career/tracker/${encodeURIComponent(trackerId)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Phase 5: Career Copilot API
// ============================================================================

/**
 * List all Copilot guidance conversations for candidate
 * @returns {Promise<{ status: string, count: number, conversations: Array }>}
 */
export async function fetchCopilotConversations() {
  return request('/api/v1/career/copilot/conversations');
}

/**
 * Start a new Career Copilot conversation thread
 * @param {Object} [payload]
 * @param {string} [payload.title]
 * @returns {Promise<Object>}
 */
export async function createCopilotConversation(payload = {}) {
  return request('/api/v1/career/copilot/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch full conversation history and message stream
 * @param {number|string} conversationId
 * @returns {Promise<Object>}
 */
export async function fetchCopilotConversation(conversationId) {
  return request(`/api/v1/career/copilot/conversations/${encodeURIComponent(conversationId)}`);
}

/**
 * Delete a Copilot conversation
 * @param {number|string} conversationId
 * @returns {Promise<{ status: string, message: string }>}
 */
export async function deleteCopilotConversation(conversationId) {
  return request(`/api/v1/career/copilot/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  });
}

/**
 * Send a question to Career Copilot and receive grounded response
 * @param {number|string} conversationId
 * @param {string} content
 * @returns {Promise<Object>}
 */
export async function sendCopilotMessage(conversationId, content) {
  return request(`/api/v1/career/copilot/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
}



