import dotenv from 'dotenv';
import { connectDB, getCollections } from '../config/db.js';
dotenv.config();

const sampleTutors = [
  {
    name: 'Dr. Tanvir Ahmed',
    email: 'tanvir.buet@gmail.com',
    role: 'tutor',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
    phone: '+8801711223344',
    bio: 'BUET CSE Graduate (Batch 14) with 8+ years of experience mentoring high school and HSC students in Higher Math and Physics.',
    plan: 'pro',
    createdAt: new Date(),
  },
  {
    name: 'Nusrat Jahan',
    email: 'nusrat.du.eng@gmail.com',
    role: 'tutor',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop',
    phone: '+8801819556677',
    bio: 'Masters in English Literature from Dhaka University. IELTS Overall Band 8.5 Trainer specializing in Spoken English and Academic Writing.',
    plan: 'pro',
    createdAt: new Date(),
  },
  {
    name: 'Abrar Shahriar',
    email: 'abrar.medical@gmail.com',
    role: 'tutor',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
    phone: '+8801912334455',
    bio: 'Dhaka Medical College (Final Year). 4 years of passionate teaching experience in HSC Biology and Medical Admission preparation.',
    plan: 'pro',
    createdAt: new Date(),
  },
  {
    name: 'Farhana Akter Rima',
    email: 'farhana.chem@gmail.com',
    role: 'tutor',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=400&auto=format&fit=crop',
    phone: '+8801611778899',
    bio: 'Lecturer in Chemistry (SUST Graduate). Known for simplifying Organic Chemistry reactions and practical problem solving.',
    plan: 'free',
    createdAt: new Date(),
  },
  {
    name: 'Tahmidur Rahman',
    email: 'tahmid.code@gmail.com',
    role: 'tutor',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop',
    phone: '+8801511223388',
    bio: 'Senior Full-Stack Engineer and competitive programmer. Mentoring HSC ICT, Python, and Web Development for high school & university beginners.',
    plan: 'pro',
    createdAt: new Date(),
  }
];

const sampleStudents = [
  {
    name: 'Sadia Rahman',
    email: 'student.sadia@gmail.com',
    role: 'student',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
    phone: '+8801755112233',
    bio: 'HSC Candidate preparing for engineering admission tests.',
    plan: 'free',
    createdAt: new Date(),
  },
  {
    name: 'Rafiul Islam',
    email: 'student.rafiul@gmail.com',
    role: 'student',
    image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=400&auto=format&fit=crop',
    phone: '+8801822445566',
    bio: 'Class 10 SSC Candidate aiming for Golden GPA 5 in Science.',
    plan: 'free',
    createdAt: new Date(),
  }
];

const sampleAdmin = {
  name: 'System Admin',
  email: 'admin@mentorlagbe.com',
  role: 'admin',
  image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=400&auto=format&fit=crop',
  phone: '+8801700000000',
  bio: 'Platform Moderator & Chief Academic Administrator at MentorLagbe.',
  plan: 'pro',
  createdAt: new Date(),
};

const sampleTuitions = [
  {
    title: 'HSC Higher Mathematics Complete Batch (Paper 1 & 2)',
    subject: 'Higher Mathematics',
    classLevel: 'Class 12 / HSC',
    mode: 'Online',
    location: 'Online (Zoom Live + Recorded Backup)',
    monthlyFee: 3500,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop',
    description: 'Master Calculus, Trigonometry, and Vectors with deep concept clearing and solve previous 10-year board questions and admission test problems.',
    tutorName: 'Dr. Tanvir Ahmed',
    tutorEmail: 'tanvir.buet@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
  {
    title: 'HSC Physics Concept to Problem Solving (Both Papers)',
    subject: 'Physics',
    classLevel: 'Class 12 / HSC',
    mode: 'Online',
    location: 'Online (Google Meet)',
    monthlyFee: 3200,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?q=80&w=800&auto=format&fit=crop',
    description: 'Step-by-step mathematical problem solving, Newtonian mechanics, Electromagnetism, and Modern Physics tailored for both Board GPA-5 and Admission.',
    tutorName: 'Dr. Tanvir Ahmed',
    tutorEmail: 'tanvir.buet@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
  },
  {
    title: 'IELTS Academic & General Comprehensive Preparation',
    subject: 'IELTS',
    classLevel: 'University / Job Candidates',
    mode: 'Online',
    location: 'Online Interactive',
    monthlyFee: 5000,
    daysPerWeek: 4,
    bannerImage: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop',
    description: 'Target Band 7.5+ in Reading, Listening, Writing Task 1 & 2, and 1-on-1 Speaking mocks with direct feedback and correction sessions.',
    tutorName: 'Nusrat Jahan',
    tutorEmail: 'nusrat.du.eng@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },
  {
    title: 'SSC English 1st & 2nd Paper Foundation Mentorship',
    subject: 'English',
    classLevel: 'Class 10 / SSC',
    mode: 'Offline',
    location: 'Dhanmondi, Dhaka',
    monthlyFee: 2800,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=800&auto=format&fit=crop',
    description: 'Right form of verbs, transformation of sentences, narration, composition, and paragraph writing techniques for guaranteed A+ in SSC English.',
    tutorName: 'Nusrat Jahan',
    tutorEmail: 'nusrat.du.eng@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
  },
  {
    title: 'HSC Biology: Botany & Zoology Mastery Batch',
    subject: 'Biology',
    classLevel: 'Class 11 & 12',
    mode: 'Online',
    location: 'Online (Zoom Live)',
    monthlyFee: 3000,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=800&auto=format&fit=crop',
    description: 'Learn anatomy, genetics, taxonomy, and human physiology through 3D diagram illustrations and mnemonic techniques designed for Medical Aspirants.',
    tutorName: 'Abrar Shahriar',
    tutorEmail: 'abrar.medical@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
  },
  {
    title: 'Medical Admission Biology Special Crash Course',
    subject: 'Medical Admission',
    classLevel: 'Admission Aspirants',
    mode: 'Offline',
    location: 'Farmgate, Dhaka',
    monthlyFee: 4500,
    daysPerWeek: 4,
    bannerImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=800&auto=format&fit=crop',
    description: 'Daily MCQ quizzes, book markings (Abul Hasan & Gazi Azmal Sir), question bank analysis, and mock tests to secure top ranks in MATS & MBBS.',
    tutorName: 'Abrar Shahriar',
    tutorEmail: 'abrar.medical@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    title: 'HSC Chemistry: Organic & Inorganic Reaction Mechanics',
    subject: 'Chemistry',
    classLevel: 'Class 12 / HSC',
    mode: 'Online',
    location: 'Online (Interactive Whiteboard)',
    monthlyFee: 3200,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?q=80&w=800&auto=format&fit=crop',
    description: 'Understand every mechanism of Organic Chemistry, Electrochemistry, and Quantitative Chemistry without blind memorization.',
    tutorName: 'Farhana Akter Rima',
    tutorEmail: 'farhana.chem@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    title: 'HSC ICT: C Programming & HTML/Database Full Syllabus',
    subject: 'ICT & Programming',
    classLevel: 'Class 11 & 12',
    mode: 'Online',
    location: 'Online Live Coding',
    monthlyFee: 2500,
    daysPerWeek: 2,
    bannerImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
    description: 'Hands-on live coding in C language, flowchart to algorithm translation, Number systems, HTML web design, and SQL query fundamentals.',
    tutorName: 'Tahmidur Rahman',
    tutorEmail: 'tahmid.code@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    title: 'Python for High Schoolers & Absolute Beginners',
    subject: 'Programming',
    classLevel: 'Class 8 to 12',
    mode: 'Online',
    location: 'Online (Discord & Google Meet)',
    monthlyFee: 3000,
    daysPerWeek: 2,
    bannerImage: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?q=80&w=800&auto=format&fit=crop',
    description: 'Build fun games, solve logic puzzles, and learn Python syntax, loops, functions, and OOP in an engaging, beginner-friendly atmosphere.',
    tutorName: 'Tahmidur Rahman',
    tutorEmail: 'tahmid.code@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    title: 'Class 9-10 General Science & Math Batch (SSC Special)',
    subject: 'General Science & Math',
    classLevel: 'Class 9 / 10',
    mode: 'Offline',
    location: 'Uttara, Sector 7, Dhaka',
    monthlyFee: 3500,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop',
    description: 'Complete syllabus revision with weekly chapter-wise exams and personal attention for SSC Science background students.',
    tutorName: 'Dr. Tanvir Ahmed',
    tutorEmail: 'tanvir.buet@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
  },
  {
    title: 'HSC Accounting & Business Studies Special Care',
    subject: 'Accounting',
    classLevel: 'Class 11 & 12',
    mode: 'Offline',
    location: 'Mirpur 10, Dhaka',
    monthlyFee: 3000,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800&auto=format&fit=crop',
    description: 'Financial accounting, worksheet, cash flow, ratio analysis, and business management concepts tailored for Commerce stream students.',
    tutorName: 'Nusrat Jahan',
    tutorEmail: 'nusrat.du.eng@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
  },
  {
    title: 'Spoken English & Professional Communication BootCamp',
    subject: 'Spoken English',
    classLevel: 'College & University Students',
    mode: 'Online',
    location: 'Online Live',
    monthlyFee: 2600,
    daysPerWeek: 3,
    bannerImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800&auto=format&fit=crop',
    description: 'Overcome hesitation in English conversation, correct your pronunciation, polish your presentation skills, and ace viva interviews with confidence.',
    tutorName: 'Nusrat Jahan',
    tutorEmail: 'nusrat.du.eng@gmail.com',
    approvalStatus: 'approved',
    isActive: true,
    createdAt: new Date(),
  }
];

export async function runSeed() {
  try {
    const db = await connectDB();
    const { usersCollection, tuitionsCollection, applicationsCollection, paymentsCollection, reviewsCollection } = getCollections();

    console.log('[Seed] Connected to database. Seeding collections...');

    // Clear old sample data
    await usersCollection.deleteMany({});
    await tuitionsCollection.deleteMany({});
    await applicationsCollection.deleteMany({});
    await paymentsCollection.deleteMany({});
    await reviewsCollection.deleteMany({});

    // Insert Users
    const allUsers = [...sampleTutors, ...sampleStudents, sampleAdmin];
    await usersCollection.insertMany(allUsers);
    console.log(`[Seed] Inserted ${allUsers.length} users (Tutors, Students, Admin).`);

    // Insert Tuitions
    const tuitionResult = await tuitionsCollection.insertMany(sampleTuitions);
    console.log(`[Seed] Inserted ${sampleTuitions.length} rich approved tuitions.`);

    // Keep applications and payments clean so all accounts start 100% fresh
    console.log('[Seed] Applications & payments kept completely clean for fresh evaluation.');

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

// Run if called directly
// Run seed immediately
runSeed();
if (false) {
  runSeed();
}
