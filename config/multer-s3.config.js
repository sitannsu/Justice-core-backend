const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, s3Config, detectBucketRegion } = require('./s3.config');
const path = require('path');

// Debug logging for S3 configuration
console.log('🔧 Multer S3 Configuration:');
console.log(`  - Bucket: ${s3Config.bucket}`);
console.log(`  - Region: ${s3Config.region}`);
console.log(`  - ACL: ${s3Config.acl}`);
console.log(`  - S3 Client configured: ${s3Client ? 'Yes' : 'No'}`);

// Detect actual bucket region
detectBucketRegion().then(actualRegion => {
  if (actualRegion !== s3Config.region) {
    console.log(`🔄 S3 bucket region is actually ${actualRegion}, but client is configured for ${s3Config.region}.`);
    console.log(`⚠️ Please update your AWS_REGION environment variable to avoid upload errors.`);
  }
});

const fs = require('fs');

// Configure local disk storage as a fallback
const localStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/documents';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

// Configure multer S3 storage
const s3Storage = multerS3({
  s3: s3Client,
  bucket: s3Config.bucket,
  acl: s3Config.acl,
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      uploadedBy: req.user?.userId || 'unknown',
      uploadedAt: new Date().toISOString()
    });
  },
  key: function (req, file, cb) {
    // Generate unique filename with timestamp and random suffix
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const key = `documents/${req.user?.userId || 'unknown'}/${uniqueSuffix}${ext}`;
    cb(null, key);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Word, text, and image files are allowed.'), false);
  }
};

// Initial storage selection - will be updated if S3 test fails
let currentStorage = (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  ? s3Storage
  : localStorage;

// Create multer instance
const upload = multer({
  storage: currentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

// Test S3 connection and fallback if needed
const testS3Connection = async () => {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.log('ℹ️  S3 not configured, using local storage');
    upload.storage = localStorage;
    return;
  }

  try {
    const { ListBucketsCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new ListBucketsCommand({}));
    console.log('✅ S3 connection test successful');
  } catch (error) {
    console.error('❌ S3 connection test failed, falling back to local storage:', error.message);
    upload.storage = localStorage;
  }
};

// Test connection on startup
testS3Connection();

module.exports = { upload, s3Client, s3Config, localStorage };
