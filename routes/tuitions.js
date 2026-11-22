import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyTutor, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Public: Browse Tuitions with Challenge 1 (Server-Side Search & Filter) & Optional 1 (Pagination)
 * GET /api/tuitions/public
 * Query params: search, subject, classLevel, mode, page, limit, sortBy
 */
router.get('/public', async (req, res) => {
  try {
    const { tuitionsCollection, usersCollection } = getCollections();
    const {
      search = '',
      subject = '',
      classLevel = '',
      mode = '',
      page = 1,
      limit = 9,
      sortBy = 'newest'
    } = req.query;

    const query = {
      approvalStatus: 'approved',
      isActive: true,
    };

    // Dynamic search by title or subject
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { title: searchRegex },
        { subject: searchRegex },
        { location: searchRegex },
        { tutorName: searchRegex }
      ];
    }

    // Filter by subject
    if (subject && subject !== 'all' && subject.trim() !== '') {
      query.subject = { $regex: `^${subject.trim()}$`, $options: 'i' };
    }

    // Filter by classLevel
    if (classLevel && classLevel !== 'all' && classLevel.trim() !== '') {
      query.classLevel = classLevel.trim();
    }

    // Filter by mode ('Online' | 'Offline')
    if (mode && mode !== 'all' && mode.trim() !== '') {
      query.mode = mode.trim();
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit, 10) || 9);
    const skip = (pageNumber - 1) * limitNumber;

    let sortOption = { createdAt: -1 };
    if (sortBy === 'fee_low_high') {
      sortOption = { monthlyFee: 1 };
    } else if (sortBy === 'fee_high_low') {
      sortOption = { monthlyFee: -1 };
    }

    const total = await tuitionsCollection.countDocuments(query);
    const tuitions = await tuitionsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber)
      .toArray();

    // Populate actual mentor image and pro status from usersCollection
    const tutorEmails = [...new Set(tuitions.map((t) => t.tutorEmail).filter(Boolean))];
    const tutors = await usersCollection
      .find({ email: { $in: tutorEmails } }, { projection: { email: 1, image: 1, name: 1, plan: 1 } })
      .toArray();
    const tutorMap = new Map(tutors.map((u) => [u.email, u]));

    const enrichedTuitions = tuitions.map((t) => {
      const tutor = tutorMap.get(t.tutorEmail);
      return {
        ...t,
        tutorImage: tutor?.image || t.tutorImage || null,
        tutorName: tutor?.name || t.tutorName,
        isProTutor: tutor ? tutor.plan === 'pro' : false,
      };
    });

    res.json({
      success: true,
      data: enrichedTuitions,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching public tuitions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tuitions' });
  }
});

/**
 * Public: Featured 6 Latest Approved & Active Tuitions for Home Page
 * GET /api/tuitions/featured
 */
router.get('/featured', async (req, res) => {
  try {
    const { tuitionsCollection, usersCollection } = getCollections();
    const featured = await tuitionsCollection
      .find({ approvalStatus: 'approved', isActive: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    const tutorEmails = [...new Set(featured.map((t) => t.tutorEmail).filter(Boolean))];
    const tutors = await usersCollection
      .find({ email: { $in: tutorEmails } }, { projection: { email: 1, image: 1, name: 1, plan: 1 } })
      .toArray();
    const tutorMap = new Map(tutors.map((u) => [u.email, u]));

    const enrichedFeatured = featured.map((t) => {
      const tutor = tutorMap.get(t.tutorEmail);
      return {
        ...t,
        tutorImage: tutor?.image || t.tutorImage || null,
        tutorName: tutor?.name || t.tutorName,
        isProTutor: tutor ? tutor.plan === 'pro' : false,
      };
    });

    res.json({ success: true, data: enrichedFeatured });
  } catch (error) {
    console.error('Error fetching featured tuitions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured tuitions' });
  }
});

/**
 * Public: Tuition Details by ID
 * GET /api/tuitions/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Tuition ID format' });
    }

    const { tuitionsCollection, usersCollection } = getCollections();
    const tuition = await tuitionsCollection.findOne({ _id: new ObjectId(id) });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Tuition listing not found' });
    }

    // Fetch tutor profile summary if available
    const tutor = await usersCollection.findOne(
      { email: tuition.tutorEmail },
      { projection: { name: 1, email: 1, image: 1, phone: 1, bio: 1, plan: 1 } }
    );

    res.json({
      success: true,
      data: {
        ...tuition,
        tutorDetails: tutor || { name: tuition.tutorName, email: tuition.tutorEmail },
      },
    });
  } catch (error) {
    console.error('Error fetching tuition details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tuition details' });
  }
});

/**
 * Tutor: Create a new tuition listing
 * POST /api/tuitions
 * Enforces Free Plan quota (max 2 tuitions for Free Tutors)
 */
router.post('/', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { tuitionsCollection, usersCollection } = getCollections();
    const {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      bannerImage,
      description,
    } = req.body;

    if (!title || !subject || !classLevel || !mode || !monthlyFee || !daysPerWeek || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, subject, classLevel, mode, monthlyFee, daysPerWeek, description',
      });
    }

    // Check Tutor Plan Limit:
    // Free Tutors can post up to 2 tuitions; Pro Tutors can post unlimited tuitions.
    const currentUser = await usersCollection.findOne({ email: req.user.email });
    const isPro = currentUser && currentUser.plan === 'pro';

    if (!isPro) {
      const existingCount = await tuitionsCollection.countDocuments({ tutorEmail: req.user.email });
      if (existingCount >= 2) {
        return res.status(403).json({
          success: false,
          code: 'LIMIT_REACHED',
          message: 'Free Plan tutors can post up to 2 tuitions. Please upgrade to Pro Tutor Plan ($15) for unlimited postings!',
        });
      }
    }

    const newTuition = {
      title: title.trim(),
      subject: subject.trim(),
      classLevel: classLevel.trim(),
      mode: mode === 'Offline' ? 'Offline' : 'Online',
      location: location ? location.trim() : (mode === 'Online' ? 'Online' : 'Location Not Specified'),
      monthlyFee: parseFloat(monthlyFee) || 0,
      daysPerWeek: parseInt(daysPerWeek, 10) || 3,
      bannerImage: bannerImage || 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop',
      description: description.trim(),
      tutorName: req.user.name,
      tutorEmail: req.user.email,
      tutorImage: currentUser?.image || req.user.image || '',
      isProTutor: isPro,
      approvalStatus: 'pending',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await tuitionsCollection.insertOne(newTuition);

    res.status(201).json({
      success: true,
      message: 'Tuition post submitted successfully! Awaiting Admin approval.',
      data: { _id: result.insertedId, ...newTuition },
    });
  } catch (error) {
    console.error('Error creating tuition post:', error);
    res.status(500).json({ success: false, message: 'Failed to create tuition post' });
  }
});

/**
 * Tutor: Get all tuitions created by the logged-in tutor
 * GET /api/tuitions/tutor/my-tuitions
 */
router.get('/tutor/my-tuitions', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { tuitionsCollection } = getCollections();
    const myTuitions = await tuitionsCollection
      .find({ tutorEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: myTuitions });
  } catch (error) {
    console.error('Error fetching tutor tuitions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tuitions' });
  }
});

/**
 * Tutor: Edit/Update tuition details
 * PUT /api/tuitions/:id
 */
router.put('/:id', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Tuition ID format' });
    }

    const { tuitionsCollection } = getCollections();
    const tuition = await tuitionsCollection.findOne({ _id: new ObjectId(id) });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Tuition post not found' });
    }

    // Only owner tutor or admin can edit
    if (tuition.tutorEmail !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit this tuition' });
    }

    const {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      bannerImage,
      description,
    } = req.body;

    const updateFields = {
      updatedAt: new Date(),
    };

    if (title) updateFields.title = title.trim();
    if (subject) updateFields.subject = subject.trim();
    if (classLevel) updateFields.classLevel = classLevel.trim();
    if (mode) updateFields.mode = mode.trim();
    if (location !== undefined) updateFields.location = location.trim();
    if (monthlyFee !== undefined) updateFields.monthlyFee = parseFloat(monthlyFee);
    if (daysPerWeek !== undefined) updateFields.daysPerWeek = parseInt(daysPerWeek, 10);
    if (bannerImage) updateFields.bannerImage = bannerImage.trim();
    if (description) updateFields.description = description.trim();

    await tuitionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    res.json({
      success: true,
      message: 'Tuition post updated successfully',
      data: { ...tuition, ...updateFields },
    });
  } catch (error) {
    console.error('Error updating tuition post:', error);
    res.status(500).json({ success: false, message: 'Failed to update tuition post' });
  }
});

/**
 * Tutor: Delete a tuition post
 * DELETE /api/tuitions/:id
 */
router.delete('/:id', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Tuition ID format' });
    }

    const { tuitionsCollection, applicationsCollection } = getCollections();
    const tuition = await tuitionsCollection.findOne({ _id: new ObjectId(id) });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Tuition not found' });
    }

    if (tuition.tutorEmail !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this tuition' });
    }

    await tuitionsCollection.deleteOne({ _id: new ObjectId(id) });
    // Also remove applications linked to this tuition
    await applicationsCollection.deleteMany({ tuitionId: id });

    res.json({ success: true, message: 'Tuition post deleted successfully' });
  } catch (error) {
    console.error('Error deleting tuition:', error);
    res.status(500).json({ success: false, message: 'Failed to delete tuition' });
  }
});

/**
 * Tutor: Toggle Active / Closed status
 * PATCH /api/tuitions/:id/toggle-status
 */
router.patch('/:id/toggle-status', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Tuition ID' });
    }

    const { tuitionsCollection } = getCollections();
    const tuition = await tuitionsCollection.findOne({ _id: new ObjectId(id) });

    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Tuition not found' });
    }

    if (tuition.tutorEmail !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const newStatus = !tuition.isActive;
    await tuitionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive: newStatus, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Tuition is now ${newStatus ? 'Active' : 'Closed'}`,
      isActive: newStatus,
    });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
});

/**
 * Admin: Get all tuition posts (all statuses)
 * GET /api/tuitions/admin/all
 */
router.get('/admin/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { tuitionsCollection } = getCollections();
    const allTuitions = await tuitionsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data: allTuitions });
  } catch (error) {
    console.error('Error fetching admin tuitions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin tuitions' });
  }
});

/**
 * Admin: Approve or Reject a tuition post
 * PATCH /api/tuitions/:id/approval
 * Body: { approvalStatus: 'approved' | 'rejected' }
 */
router.patch('/:id/approval', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'approved', 'rejected', or 'pending'",
      });
    }

    const { tuitionsCollection } = getCollections();
    const result = await tuitionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approvalStatus, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Tuition post not found' });
    }

    res.json({
      success: true,
      message: `Tuition status updated to ${approvalStatus}`,
      approvalStatus,
    });
  } catch (error) {
    console.error('Error updating approval status:', error);
    res.status(500).json({ success: false, message: 'Failed to update approval status' });
  }
});

export default router;
