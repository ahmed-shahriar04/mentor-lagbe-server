import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyToken, verifyStudent } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Optional Requirement 5: Student Review & Rating System (1-5 Stars)
 * Allowed only for students whose application status for this tuition is 'accepted'
 */

// Get reviews for a tuition
router.get('/tuition/:tuitionId', async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { reviewsCollection } = getCollections();

    const reviews = await reviewsCollection
      .find({ tuitionId: tuitionId.toString() })
      .sort({ createdAt: -1 })
      .toArray();

    const averageRating =
      reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : 0;

    res.json({
      success: true,
      data: reviews,
      count: reviews.length,
      averageRating,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// Submit a review (accepted students only)
router.post('/tuition/:tuitionId', verifyToken, verifyStudent, async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
    }

    const { applicationsCollection, reviewsCollection, usersCollection } = getCollections();

    // Verify application status is 'accepted'
    const application = await applicationsCollection.findOne({
      tuitionId: tuitionId.toString(),
      studentEmail: req.user.email,
      status: 'accepted',
    });

    if (!application) {
      return res.status(403).json({
        success: false,
        message: 'Only students with an accepted application can submit a review for this tuition',
      });
    }

    // Check if already reviewed
    const existing = await reviewsCollection.findOne({
      tuitionId: tuitionId.toString(),
      studentEmail: req.user.email,
    });

    const studentUser = await usersCollection.findOne({ email: req.user.email });

    if (existing) {
      // Update review
      await reviewsCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            rating: parseInt(rating, 10),
            feedback: feedback ? feedback.trim() : '',
            studentImage: studentUser?.image || '',
            updatedAt: new Date(),
          },
        }
      );
      return res.json({ success: true, message: 'Review updated successfully' });
    }

    const reviewDoc = {
      tuitionId: tuitionId.toString(),
      studentEmail: req.user.email,
      studentName: req.user.name,
      studentImage: studentUser?.image || '',
      rating: parseInt(rating, 10),
      feedback: feedback ? feedback.trim() : '',
      createdAt: new Date(),
    };

    const result = await reviewsCollection.insertOne(reviewDoc);

    res.status(201).json({
      success: true,
      message: 'Thank you! Your review has been submitted.',
      data: { _id: result.insertedId, ...reviewDoc },
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

export default router;
