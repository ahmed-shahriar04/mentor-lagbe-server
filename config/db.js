import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'mentorlagbe';

let client;
let db;

export async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.log(`[Database] Successfully connected to MongoDB: ${dbName}`);
    return db;
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
    throw error;
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
}

export const getCollections = () => {
  const database = getDB();
  return {
    usersCollection: database.collection('users'),
    tuitionsCollection: database.collection('tuitions'),
    applicationsCollection: database.collection('applications'),
    paymentsCollection: database.collection('payments'),
    bookmarksCollection: database.collection('bookmarks'),
    reviewsCollection: database.collection('reviews'),
  };
};
