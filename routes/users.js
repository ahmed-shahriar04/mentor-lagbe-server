import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Get current user profile
 * GET /api/users/me
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { usersCollection } = getCollections();
    const user = await usersCollection.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

/**
 * Update Profile Page (/dashboard/profile)
 * PATCH /api/users/profile
 * Allows updating Name, Phone, Bio, and Image URL
 */
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, bio, image } = req.body;
    const { usersCollection } = getCollections();

    const updateFields = { updatedAt: new Date() };
    if (name) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (bio !== undefined) updateFields.bio = bio.trim();
    if (image) updateFields.image = image.trim();

    await usersCollection.updateOne(
      { email: req.user.email },
      { $set: updateFields }
    );

    const updatedUser = await usersCollection.findOne({ email: req.user.email });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

/**
 * Admin: Get all registered users
 * GET /api/users
 */
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { usersCollection } = getCollections();
    const users = await usersCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

/**
 * Admin: Manage User Roles ('student', 'tutor', 'admin')
 * PATCH /api/users/:id/role
 * Body: { role: 'student' | 'tutor' | 'admin' }
 */
router.patch('/:id/role', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['student', 'tutor', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Role must be 'student', 'tutor', or 'admin'",
      });
    }

    const { usersCollection } = getCollections();
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`,
      role,
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ success: false, message: 'Failed to update user role' });
  }
});

/**
 * Admin: Dashboard Overview Stats
 * GET /api/users/admin/stats
 * Reusable stats cards: Total Users, Total Tutors, Pending vs Approved Tuitions, Total Stripe Revenue
 */
router.get('/admin/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { usersCollection, tuitionsCollection, paymentsCollection } = getCollections();

    const [
      totalUsers,
      totalTutors,
      totalStudents,
      approvedTuitions,
      pendingTuitions,
      rejectedTuitions,
      payments,
    ] = await Promise.all([
      usersCollection.countDocuments(),
      usersCollection.countDocuments({ role: 'tutor' }),
      usersCollection.countDocuments({ role: 'student' }),
      tuitionsCollection.countDocuments({ approvalStatus: 'approved' }),
      tuitionsCollection.countDocuments({ approvalStatus: 'pending' }),
      tuitionsCollection.countDocuments({ approvalStatus: 'rejected' }),
      paymentsCollection.find({ paymentStatus: 'paid' }).toArray(),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTutors,
        totalStudents,
        approvedTuitions,
        pendingTuitions,
        rejectedTuitions,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTransactions: payments.length,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
  }
});

export default router;
