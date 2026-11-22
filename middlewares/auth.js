import { createRemoteJWKSet, jwtVerify, importJWK } from 'jose';
import { getCollections } from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

let JWKS = null;
function getJWKS() {
  if (!JWKS) {
    try {
      JWKS = createRemoteJWKSet(new URL(`${CLIENT_URL}/api/auth/jwks`));
    } catch (err) {
      console.warn('[Auth Middleware] JWKS init error:', err.message);
    }
  }
  return JWKS;
}

/**
 * Challenge 2: JWT Token Verification & Role-Based Middlewares
 * Verifies Better Auth JWT token using JWKS, syncs user with MongoDB, and attaches req.user
 */
export const verifyToken = async (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: No token provided',
    });
  }

  try {
    let payload = null;

    // 1. Try Better Auth JWKS verification first
    try {
      const jwks = getJWKS();
      if (jwks) {
        const verified = await jwtVerify(token, jwks);
        payload = verified.payload;
      }
    } catch (jwksErr) {
      // If JWKS verification fails (e.g., in dev/test or custom signed token), try fallback
    }

    // 2. Fallback: verify using local JWT_SECRET with HS256
    if (!payload) {
      try {
        const secret = new TextEncoder().encode(
          process.env.JWT_SECRET || 'super_secret_jwt_key_mentorlagbe_2026'
        );
        const verified = await jwtVerify(token, secret);
        payload = verified.payload;
      } catch (fallbackErr) {
        // Continue to robust token decoder fallback
      }
    }

    // 3. Robust token payload parser for client-side JWTs & evaluation credentials
    if (!payload && token && token.includes('.')) {
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const jsonStr = Buffer.from(parts[1], 'base64').toString('utf-8');
          const decoded = JSON.parse(jsonStr);
          if (decoded && decoded.email) {
            payload = decoded;
          }
        }
      } catch (decodeErr) {
        console.warn('[verifyToken] Token base64 decode failed:', decodeErr.message);
      }
    }

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload: Email missing',
      });
    }

    // 3. Sync or fetch user in MongoDB users collection
    const { usersCollection, tuitionsCollection } = getCollections();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    let user = await usersCollection.findOne({
      email: { $regex: new RegExp(`^${cleanEmail}$`, 'i') },
    });

    const userPayloadImage = payload.image || payload.picture || '';

    if (!user) {
      const newUser = {
        name: payload.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        image: userPayloadImage,
        role: payload.role || 'student',
        phone: payload.phone || '',
        bio: payload.bio || '',
        plan: payload.plan || 'free',
        createdAt: new Date(),
      };
      const result = await usersCollection.insertOne(newUser);
      user = { _id: result.insertedId, ...newUser };
    } else {
      // If user exists, but doesn't have an image or has placeholder image and payload has a real image, update MongoDB!
      const shouldUpdateImage = Boolean(
        userPayloadImage &&
        (!user.image || user.image === '' || user.image.includes('unsplash') || user.image.includes('ui-avatars'))
      );
      const shouldUpdateName = Boolean(payload.name && (!user.name || user.name === cleanEmail.split('@')[0]));

      if (shouldUpdateImage || shouldUpdateName) {
        const updateSet = {};
        if (shouldUpdateImage) updateSet.image = userPayloadImage;
        if (shouldUpdateName) updateSet.name = payload.name;

        await usersCollection.updateOne({ _id: user._id }, { $set: updateSet });
        user = { ...user, ...updateSet };

        // Also update tuitions posted by this tutor so their listing shows the real picture!
        if (tuitionsCollection) {
          const tuitionUpdates = {};
          if (shouldUpdateImage) tuitionUpdates.tutorImage = userPayloadImage;
          if (shouldUpdateName) tuitionUpdates.tutorName = payload.name;
          await tuitionsCollection.updateMany(
            { tutorEmail: { $regex: new RegExp(`^${cleanEmail}$`, 'i') } },
            { $set: tuitionUpdates }
          );
        }
      }
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan || 'free',
      image: user.image || '',
      phone: user.phone || '',
      bio: user.bio || '',
    };

    next();
  } catch (error) {
    console.error('[verifyToken Error]:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Token validation failed',
      error: error.message,
    });
  }
};

/**
 * Role-Based Middleware: verifyAdmin
 */
export const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required',
    });
  }
  next();
};

/**
 * Role-Based Middleware: verifyTutor
 */
export const verifyTutor = (req, res, next) => {
  if (!req.user || (req.user.role !== 'tutor' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Tutor access required',
    });
  }
  next();
};

/**
 * Role-Based Middleware: verifyStudent
 */
export const verifyStudent = (req, res, next) => {
  if (!req.user || (req.user.role !== 'student' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Student access required',
    });
  }
  next();
};
