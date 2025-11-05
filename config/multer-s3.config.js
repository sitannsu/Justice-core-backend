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
    console.log(`🔄 Updating S3 client to use actual bucket region: ${actualRegion}`);
    // Update S3 client with correct region
    s3Client.config.region = actualRegion;
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

// Create multer instance with S3 storage
const upload = multer({
  storage: s3Storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

// Test S3 connection
const testS3Connection = async () => {
  try {
    // First test basic S3 access
    const { ListBucketsCommand } = require('@aws-sdk/client-s3');
    const command = new ListBucketsCommand({});
    await s3Client.send(command);
    console.log('✅ S3 connection test successful');
    
    // Then test specific bucket access
    const { HeadBucketCommand } = require('@aws-sdk/client-s3');
    const bucketCommand = new HeadBucketCommand({ Bucket: s3Config.bucket });
    await s3Client.send(bucketCommand);
    console.log(`✅ Bucket '${s3Config.bucket}' access test successful`);
    
  } catch (error) {
    console.error('❌ S3 connection test failed:', error.message);
    
    if (error.name === 'UnauthorizedOperation') {
      console.error('💡 Check your AWS credentials and permissions');
    } else if (error.name === 'PermanentRedirect') {
      console.error('💡 Region mismatch detected. The bucket is in a different region.');
      console.error('💡 Try updating AWS_REGION in your .env file');
    } else if (error.name === 'NoSuchBucket') {
      console.error(`💡 Bucket '${s3Config.bucket}' does not exist`);
    }
  }
};

// Test connection on startup
testS3Connection();

module.exports = { upload, s3Client, s3Config };
