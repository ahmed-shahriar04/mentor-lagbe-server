import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyStudent } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Optional Requirement 3: Bookmark / Saved Tuitions for Students
 * Free Students: max 5 bookmarks; Pro Students: unlimited bookmarks
 */

// Get all bookmarks for the logged-in student
router.get('/', verifyToken, verifyStudent, async (req, res) => {
  try {
    const { bookmarksCollection, tuitionsCollection } = getCollections();
    const bookmarks = await bookmarksCollection
      .find({ userEmail: req.user.email })
      .sort({ savedAt: -1 })
      .toArray();

    // Fetch corresponding tuition details
    const tuitionIds = bookmarks.map((b) => {
      try {
        return new ObjectId(b.tuitionId);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    const tuitions = await tuitionsCollection.find({ _id: { $in: tuitionIds } }).toArray();

    res.json({
      success: true,
      data: tuitions,
      bookmarks,
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookmarks' });
  }
});

// Add bookmark
router.post('/:tuitionId', verifyToken, verifyStudent, async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { bookmarksCollection, usersCollection, tuitionsCollection } = getCollections();

    // Verify tuition exists
    const tuition = await tuitionsCollection.findOne({ _id: new ObjectId(tuitionId) });
    if (!tuition) {
      return res.status(404).json({ success: false, message: 'Tuition not found' });
    }

    // Check existing
    const existing = await bookmarksCollection.findOne({
      userEmail: req.user.email,
      tuitionId: tuitionId.toString(),
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Already bookmarked' });
    }

    // Check quota for Free Students (max 5 bookmarks)
    const user = await usersCollection.findOne({ email: req.user.email });
    const isPro = user && user.plan === 'pro';

    if (!isPro) {
      const count = await bookmarksCollection.countDocuments({ userEmail: req.user.email });
      if (count >= 5) {
        return res.status(403).json({
          success: false,
          code: 'BOOKMARK_LIMIT_REACHED',
          message: 'Free students can bookmark up to 5 tuitions. Upgrade to Pro Student Plan ($10) for unlimited bookmarks!',
        });
      }
    }

    await bookmarksCollection.insertOne({
      userEmail: req.user.email,
      tuitionId: tuitionId.toString(),
      savedAt: new Date(),
    });

    res.json({ success: true, message: 'Tuition bookmarked successfully' });
  } catch (error) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ success: false, message: 'Failed to bookmark tuition' });
  }
});

// Remove bookmark
router.delete('/:tuitionId', verifyToken, verifyStudent, async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { bookmarksCollection } = getCollections();

    await bookmarksCollection.deleteOne({
      userEmail: req.user.email,
      tuitionId: tuitionId.toString(),
    });

    res.json({ success: true, message: 'Bookmark removed successfully' });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({ success: false, message: 'Failed to remove bookmark' });
  }
});

export default router;
