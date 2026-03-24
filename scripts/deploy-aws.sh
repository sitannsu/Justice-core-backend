#!/bin/bash

# Configuration
REGION="us-east-1"  # Update with your region
IMAGE_NAME="justice-core-backend"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ $? -ne 0 ]; then
  echo "Error: Failed to get AWS Account ID. Make sure AWS CLI is configured."
  exit 1
fi

ECR_URL="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "Using ECR URL: ${ECR_URL}"

# Authenticate Docker to ECR
echo "Authenticating Docker to ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URL}

# Build the image
echo "Building Docker image: ${IMAGE_NAME}..."
docker build -t ${IMAGE_NAME} .

# Tag for ECR
echo "Tagging image for ECR..."
docker tag ${IMAGE_NAME}:latest ${ECR_URL}/${IMAGE_NAME}:latest

# Push to ECR
echo "Pushing image to ECR..."
docker push ${ECR_URL}/${IMAGE_NAME}:latest

echo "Done! Image pushed to: ${ECR_URL}/${IMAGE_NAME}:latest"
