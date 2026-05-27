import CitizenModel from '../models/citizen.model.js';
import OtpModel from '../models/otp.model.js';
import { generateOtp, getOtpExpiry, isOtpExpired, sendOtpSms } from '../utils/otpHelper.js';
import { signToken } from '../utils/jwtHelper.js';
import { success, error } from '../utils/responseHelper.js';

/**
 * Citizen Authentication Controller.
 */

/**
 * POST /api/auth/citizen/send-otp
 * Send OTP for citizen login.
 */
export async function sendOtp(req, res, next) {
  try {
    const { mobile } = req.body;
    console.log(`[OTP] send-otp hit for mobile: ${mobile}`);

    // Check if citizen exists (for login)
    const citizen = CitizenModel.findByMobile(mobile);
    if (!citizen) {
      return error(res, 'No account found with this mobile number. Please sign up first.', 404);
    }

    // Generate and store OTP
    const otp = generateOtp();
    const expiresAt = getOtpExpiry();

    OtpModel.create({
      mobile,
      otp_code: otp,
      purpose: 'login',
      expires_at: expiresAt,
    });

    // Simulate sending SMS
    sendOtpSms(mobile, otp);

    return success(res, { mobile }, 'OTP sent successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/citizen/verify-otp
 * Verify OTP and login citizen.
 */
export async function verifyOtp(req, res, next) {
  try {
    const { mobile, otp } = req.body;

    // Find latest OTP record
    const otpRecord = OtpModel.findLatestByMobile(mobile, 'login');

    if (!otpRecord) {
      return error(res, 'No OTP found. Please request a new one.', 400);
    }

    if (isOtpExpired(otpRecord.expires_at)) {
      return error(res, 'OTP has expired. Please request a new one.', 400);
    }

    if (otpRecord.otp_code !== otp) {
      return error(res, 'Invalid OTP. Please try again.', 400);
    }

    // Mark OTP as verified
    OtpModel.markVerified(otpRecord.id);

    // Find citizen
    const citizen = CitizenModel.findByMobile(mobile);
    if (!citizen) {
      return error(res, 'Citizen account not found.', 404);
    }

    // Generate JWT
    const token = signToken({ id: citizen.id, role: 'citizen' });

    return success(res, {
      token,
      user: {
        id: citizen.id,
        full_name: citizen.full_name,
        mobile: citizen.mobile,
        area: citizen.area,
        pincode: citizen.pincode,
        preferred_language: citizen.preferred_language,
        profile_picture: citizen.profile_picture,
      },
    }, 'Login successful.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/citizen/signup
 * Register a new citizen and send OTP for verification.
 */
export async function signup(req, res, next) {
  try {
    const { full_name, mobile, area, pincode, preferred_language } = req.body;
    console.log(`[OTP] signup hit for mobile: ${mobile}`);

    // Check if citizen already exists
    const existing = CitizenModel.findByMobile(mobile);
    if (existing) {
      return error(res, 'An account with this mobile number already exists.', 409);
    }

    // Generate and store OTP
    const otp = generateOtp();
    const expiresAt = getOtpExpiry();

    OtpModel.create({
      mobile,
      otp_code: otp,
      purpose: 'signup',
      expires_at: expiresAt,
    });

    // Simulate sending SMS
    sendOtpSms(mobile, otp);

    // Store signup data temporarily in the response so frontend can resend
    return success(res, {
      mobile,
      signup_data: { full_name, area, pincode, preferred_language },
    }, 'OTP sent for verification. Please verify to complete signup.', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/citizen/verify-signup
 * Verify OTP and create citizen account.
 */
export async function verifySignup(req, res, next) {
  try {
    const { mobile, otp, full_name, area, pincode, preferred_language } = req.body;

    // Find latest OTP record
    const otpRecord = OtpModel.findLatestByMobile(mobile, 'signup');

    if (!otpRecord) {
      return error(res, 'No OTP found. Please request a new one.', 400);
    }

    if (isOtpExpired(otpRecord.expires_at)) {
      return error(res, 'OTP has expired. Please request a new one.', 400);
    }

    if (otpRecord.otp_code !== otp) {
      return error(res, 'Invalid OTP. Please try again.', 400);
    }

    // Mark OTP as verified
    OtpModel.markVerified(otpRecord.id);

    // Check if citizen already exists (double-check)
    const existing = CitizenModel.findByMobile(mobile);
    if (existing) {
      return error(res, 'An account with this mobile number already exists.', 409);
    }

    // Get profile picture path if uploaded
    const profile_picture = req.file ? `/uploads/profiles/${req.file.filename}` : null;

    // Create citizen account
    const citizen = CitizenModel.create({
      full_name,
      mobile,
      area,
      pincode,
      preferred_language: preferred_language || 'English',
      profile_picture,
    });

    // Generate JWT
    const token = signToken({ id: citizen.id, role: 'citizen' });

    return success(res, {
      token,
      user: citizen,
    }, 'Account created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/citizen/profile
 * Get logged-in citizen's profile.
 */
export async function getProfile(req, res, next) {
  try {
    const citizen = CitizenModel.findById(req.user.id);

    if (!citizen) {
      return error(res, 'Citizen not found.', 404);
    }

    return success(res, { user: citizen }, 'Profile fetched successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/citizen/profile
 * Update logged-in citizen's profile.
 */
export async function updateProfile(req, res, next) {
  try {
    const fields = { ...req.body };

    // Handle profile picture upload
    if (req.file) {
      fields.profile_picture = `/uploads/profiles/${req.file.filename}`;
    }

    const updated = CitizenModel.update(req.user.id, fields);

    if (!updated) {
      return error(res, 'No fields to update.', 400);
    }

    return success(res, { user: updated }, 'Profile updated successfully.');
  } catch (err) {
    next(err);
  }
}
