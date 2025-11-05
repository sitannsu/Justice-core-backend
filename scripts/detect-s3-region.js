require('dotenv').config();
const { S3Client, GetBucketLocationCommand } = require('@aws-sdk/client-s3');

async function detectBucketRegion() {
  const bucketName = process.env.AWS_S3_BUCKET;
  
  if (!bucketName) {
    console.error('❌ AWS_S3_BUCKET not set in .env file');
    return;
  }

  // Try different regions to find the bucket
  const regions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'
  ];

  for (const region of regions) {
    try {
      console.log(`🔍 Trying region: ${region}`);
      
      const s3Client = new S3Client({
        region: region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });

      const command = new GetBucketLocationCommand({ Bucket: bucketName });
      const response = await s3Client.send(command);
      
      const actualRegion = response.LocationConstraint || 'us-east-1';
      console.log(`✅ Found bucket '${bucketName}' in region: ${actualRegion}`);
      console.log(`💡 Update your .env file with: AWS_REGION=${actualRegion}`);
      return actualRegion;
      
    } catch (error) {
      if (error.name === 'NoSuchBucket') {
        console.log(`❌ Bucket not found in ${region}`);
      } else if (error.name === 'PermanentRedirect') {
        console.log(`⚠️  Redirect detected in ${region} - bucket might be here`);
      } else {
        console.log(`❌ Error in ${region}: ${error.message}`);
      }
    }
  }
  
  console.error('❌ Could not determine bucket region. Check if bucket exists and credentials are correct.');
}

detectBucketRegion().catch(console.error);
