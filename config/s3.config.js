require('dotenv').config();
const { S3Client } = require('@aws-sdk/client-s3');

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// S3 bucket configuration
const s3Config = {
  bucket: process.env.AWS_S3_BUCKET || 'video-travel-2025',
  region: process.env.AWS_REGION || 'eu-north-1',
  acl: 'private', // or 'public-read' if you want public access
};

// Validate required environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS credentials not found in environment variables');
  console.error('Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in your .env file');
} else {
  console.log('✅ AWS S3 credentials loaded successfully');
  console.log(`📦 S3 Bucket: ${s3Config.bucket}`);
  console.log(`🌍 Region: ${s3Config.region}`);
}

// Function to detect bucket region bypassed to avoid causing misleading logs
const detectBucketRegion = async () => {
  return process.env.AWS_REGION || 'eu-north-1';
};

module.exports = { s3Client, s3Config, detectBucketRegion };
