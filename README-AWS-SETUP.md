# AWS S3 Setup for File Uploads

## Prerequisites
1. AWS Account with S3 access
2. S3 bucket created
3. IAM user with S3 permissions

## Environment Variables
Create a `.env` file in the backend root directory with the following variables:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=docket-digital-documents

# Other configurations
PORT=3006
MONGODB_URI=mongodb://localhost:27017/docket-digital
JWT_SECRET=your_jwt_secret_here
```

## IAM User Permissions
Your IAM user needs the following S3 permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::docket-digital-documents/*"
        }
    ]
}
```

## S3 Bucket Configuration
1. Create a bucket named `docket-digital-documents` (or update AWS_S3_BUCKET in .env)
2. Enable versioning (optional but recommended)
3. Configure lifecycle policies as needed
4. Set appropriate CORS if needed for direct browser uploads

## File Structure in S3
Files will be stored with the following structure:
```
documents/
├── user_id_1/
│   ├── timestamp-random1.pdf
│   └── timestamp-random2.docx
└── user_id_2/
    └── timestamp-random3.png
```

## Security Features
- Private ACL by default
- Signed URLs for downloads (1-hour expiry)
- User-based access control
- File type validation
- Size limits (10MB max)
