import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Authenticate or retrieve user profile during sign in
 * POST /api/users/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const { usersCollection } = getCollections();
    const cleanEmail = email.trim().toLowerCase();

    let user = await usersCollection.findOne({
      email: { $regex: new RegExp(`^${cleanEmail}$`, 'i') },
    });

    if (!user) {
      let defaultRole = 'student';
      if (cleanEmail.includes('admin') || cleanEmail === 'shahriarahmedriaz_admin@mentrolagbe.com') {
        defaultRole = 'admin';
      } else if (cleanEmail.includes('tutor') || cleanEmail === 'shahriarahmedriaz.tutor@mentorlagbe.com') {
        defaultRole = 'tutor';
      }

      const newUser = {
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: defaultRole,
        plan: 'free',
        image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=120&auto=format&fit=crop',
        createdAt: new Date(),
      };
      const result = await usersCollection.insertOne(newUser);
      user = { _id: result.insertedId, ...newUser };
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan || 'free',
        image: user.image || '',
        phone: user.phone || '',
        bio: user.bio || '',
      },
    });
  } catch (error) {
    console.error('Error during user login:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
});

/**
 * Get current user profile
 * GET /api/users/me
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { usersCollection, paymentsCollection } = getCollections();
    const cleanEmail = (req.user.email || '').trim().toLowerCase();

    // Purge mock payments if any
    await paymentsCollection.deleteMany({
      $or: [
        { transactionId: { $regex: /^txn_mock_/i } },
        { userEmail: 'student.sadia@gmail.com' },
      ],
    });

    const user = await usersCollection.findOne({
      email: { $regex: new RegExp(`^${cleanEmail}$`, 'i') },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only grant Pro plan if genuine verified payment exists
    const hasPaid = await paymentsCollection.findOne({
      userEmail: user.email,
      paymentStatus: 'paid',
      transactionId: { $not: /^txn_mock_/i },
    });

    user.plan = hasPaid ? 'pro' : 'free';
    await usersCollection.updateOne({ _id: user._id }, { $set: { plan: user.plan } });

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

    // Also sync tutor name and avatar on all their posted tuitions
    const { tuitionsCollection } = getCollections();
    const tuitionUpdates = {};
    if (name) tuitionUpdates.tutorName = name.trim();
    if (image) tuitionUpdates.tutorImage = image.trim();
    if (Object.keys(tuitionUpdates).length > 0) {
      await tuitionsCollection.updateMany(
        { tutorEmail: req.user.email },
        { $set: tuitionUpdates }
      );
    }

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
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { _id: id }] }
      : { _id: id };

    const result = await usersCollection.updateOne(
      query,
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

/**
 * Delete Current User Account (/dashboard/profile)
 * DELETE /api/users/profile/me
 */
router.delete('/profile/me', verifyToken, async (req, res) => {
  try {
    const { usersCollection } = getCollections();
    const result = await usersCollection.deleteOne({ email: req.user.email });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting own account:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
});

/**
 * Admin: Delete User
 * DELETE /api/users/:id
 */
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { usersCollection } = getCollections();

    // Prevent deleting oneself
    const targetUser = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (targetUser.email === req.user.email) {
      return res.status(400).json({ success: false, message: 'Admin cannot delete their own active account' });
    }

    await usersCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: `User ${targetUser.name} deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

export default router;
