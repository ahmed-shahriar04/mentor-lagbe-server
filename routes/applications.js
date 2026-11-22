import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyStudent, verifyTutor } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Student: Apply for a tuition
 * POST /api/applications
 * Body: { tuitionId, studentPhone, preferredSchedule, studentNote }
 * Blocks Tutors/Admins, prevents duplicate application
 */
router.post('/', verifyToken, verifyStudent, async (req, res) => {
  try {
    const { tuitionId, studentPhone, preferredSchedule, studentNote } = req.body;

    if (!tuitionId || !studentPhone || !preferredSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Please provide tuitionId, studentPhone, and preferredSchedule',
      });
    }

    const { tuitionsCollection, applicationsCollection } = getCollections();

    // Verify tuition exists and is approved
    const tuition = await tuitionsCollection.findOne({ _id: new ObjectId(tuitionId) });
    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Tuition listing not found' });
    }

    if (tuition.approvalStatus !== 'approved' || !tuition.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This tuition post is currently closed or not approved for applications',
      });
    }

    // Check duplicate application from same student
    const existing = await applicationsCollection.findOne({
      tuitionId: tuitionId.toString(),
      studentEmail: req.user.email,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this tuition batch',
      });
    }

    const newApplication = {
      tuitionId: tuition._id.toString(),
      tuitionTitle: tuition.title,
      subject: tuition.subject,
      monthlyFee: tuition.monthlyFee,
      tutorEmail: tuition.tutorEmail,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentPhone: studentPhone.trim(),
      preferredSchedule: preferredSchedule.trim(),
      studentNote: studentNote ? studentNote.trim() : '',
      status: 'pending',
      appliedAt: new Date(),
    };

    const result = await applicationsCollection.insertOne(newApplication);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully! The tutor will review your request.',
      data: { _id: result.insertedId, ...newApplication },
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ success: false, message: 'Failed to submit application' });
  }
});

/**
 * Student: Get all applications submitted by logged-in student
 * GET /api/applications/student/my
 */
router.get('/student/my', verifyToken, async (req, res) => {
  try {
    const { applicationsCollection } = getCollections();
    const myApps = await applicationsCollection
      .find({ studentEmail: req.user.email })
      .sort({ appliedAt: -1 })
      .toArray();

    res.json({ success: true, data: myApps });
  } catch (error) {
    console.error('Error fetching student applications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
});

/**
 * Student: Cancel/Delete application while status is still 'pending'
 * DELETE /api/applications/:id
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Application ID' });
    }

    const { applicationsCollection } = getCollections();
    const application = await applicationsCollection.findOne({ _id: new ObjectId(id) });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.studentEmail !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this application' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel application with status '${application.status}'`,
      });
    }

    await applicationsCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: 'Application cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling application:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel application' });
  }
});

/**
 * Tutor: Manage Applicants - Get all applicants for tutor's tuitions
 * GET /api/applications/tutor/applicants
 */
router.get('/tutor/applicants', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { applicationsCollection } = getCollections();
    const applicants = await applicationsCollection
      .find({ tutorEmail: req.user.email })
      .sort({ appliedAt: -1 })
      .toArray();

    res.json({ success: true, data: applicants });
  } catch (error) {
    console.error('Error fetching tutor applicants:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch applicants' });
  }
});

/**
 * Tutor: Update application status to 'accepted' or 'rejected'
 * PATCH /api/applications/:id/status
 * Body: { status: 'accepted' | 'rejected' }
 */
router.patch('/:id/status', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'accepted' or 'rejected'",
      });
    }

    const { applicationsCollection } = getCollections();
    const application = await applicationsCollection.findOne({ _id: new ObjectId(id) });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.tutorEmail !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this application' });
    }

    await applicationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Application has been ${status}`,
      status,
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ success: false, message: 'Failed to update application status' });
  }
});

/**
 * Student Dashboard Stats
 * GET /api/applications/student/stats
 */
router.get('/student/stats', verifyToken, async (req, res) => {
  try {
    const { applicationsCollection, usersCollection, paymentsCollection } = getCollections();
    const email = (req.user.email || '').trim().toLowerCase();

    // 1. Permanently clean up any leftover demo seed applications and mock payments
    await Promise.all([
      applicationsCollection.deleteMany({
        $or: [
          { studentEmail: 'student.sadia@gmail.com', tuitionTitle: { $regex: /Higher Math/i } },
          { studentNote: { $regex: /Calculus/i } },
          { studentPhone: '+8801755112233' },
        ],
      }),
      paymentsCollection.deleteMany({
        $or: [
          { transactionId: { $regex: /^txn_mock_/i } },
          { stripeSessionId: { $regex: /mock/i } },
          { userEmail: 'student.sadia@gmail.com' },
        ],
      }),
    ]);

    const [totalApplied, accepted, pending, genuinePayment] = await Promise.all([
      applicationsCollection.countDocuments({ studentEmail: email }),
      applicationsCollection.countDocuments({ studentEmail: email, status: 'accepted' }),
      applicationsCollection.countDocuments({ studentEmail: email, status: 'pending' }),
      paymentsCollection.findOne({
        userEmail: email,
        paymentStatus: 'paid',
        transactionId: { $not: /^txn_mock_/i },
      }),
    ]);

    // Effective plan is strictly 'pro' ONLY if a genuine Stripe payment exists
    const effectivePlan = genuinePayment ? 'pro' : 'free';

    // Synchronize usersCollection so user.plan is always accurate
    await usersCollection.updateOne(
      { email: { $regex: new RegExp(`^${email}$`, 'i') } },
      { $set: { plan: effectivePlan } }
    );

    res.json({
      success: true,
      data: {
        totalApplied,
        accepted,
        pending,
        currentPlan: effectivePlan,
      },
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student statistics' });
  }
});

/**
 * Tutor Dashboard Stats
 * GET /api/applications/tutor/stats
 */
router.get('/tutor/stats', verifyToken, async (req, res) => {
  try {
    const { tuitionsCollection, applicationsCollection, usersCollection, paymentsCollection } = getCollections();
    const email = req.user.email;

    const [totalPosted, activeApproved, totalApplicants, user, hasPaid] = await Promise.all([
      tuitionsCollection.countDocuments({ tutorEmail: email }),
      tuitionsCollection.countDocuments({ tutorEmail: email, approvalStatus: 'approved', isActive: true }),
      applicationsCollection.countDocuments({ tutorEmail: email }),
      usersCollection.findOne({ email }),
      paymentsCollection.findOne({ userEmail: email, paymentStatus: 'paid' }),
    ]);

    const effectivePlan = hasPaid ? 'pro' : (user?.plan === 'pro' ? 'pro' : 'free');

    res.json({
      success: true,
      data: {
        totalPosted,
        activeApproved,
        totalApplicants,
        currentPlan: effectivePlan,
      },
    });
  } catch (error) {
    console.error('Error fetching tutor stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tutor statistics' });
  }
});

export default router;
