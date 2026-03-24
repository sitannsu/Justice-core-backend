# AWS Docker Deployment Guide for justice-core-backend

This guide outlines the steps to build, push, and deploy the `justice-core-backend` to AWS.

## Architecture Overview
- **Storage**: AWS ECR (Elastic Container Registry) to store your Docker images.
- **Compute**: AWS ECS (Elastic Container Service) with **Fargate** (Serverless container execution).
- **Traffic Management**: Application Load Balancer (ALB) for HTTPS and health routing.

---

## 1. Prerequisites
- AWS CLI installed and configured (`aws configure`).
- Docker Desktop (or engine) running.
- Necessary IAM permissions (ECR, ECS, IAM).

## 2. Setting Up ECR (Registry)
Run the following command to create a private repository:
```bash
aws ecr create-repository \
    --repository-name justice-core-backend \
    --region us-east-1
```
*(Replace `us-east-1` with your preferred region)*.

## 3. Building and Pushing to ECR
I've created a script `scripts/deploy-aws.sh` to automate this, but here are the manual steps:

1. **Authenticate Docker with ECR**:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   ```

2. **Build the Image**:
   ```bash
   docker build -t justice-core-backend .
   ```

3. **Tag for ECR**:
   ```bash
   docker tag justice-core-backend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/justice-core-backend:latest
   ```

4. **Push to ECR**:
   ```bash
   docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/justice-core-backend:latest
   ```

---

## 4. Setting up ECS (Container Service)
1. **Create ECS Cluster**:
   - Go to ECS Console -> Clusters -> Create Cluster.
   - Choose a name (e.g., `justice-core-cluster`).
   - Use default VPC and Subnets.

2. **Define Task (Fargate)**:
   - Go to Task Definitions -> Create New Task Definition.
   - Specify Container Name: `justice-core-backend`.
   - Image URI: `YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/justice-core-backend:latest`.
   - Port Mapping: `3006`.
   - **Environment Variables**: Use **AWS Secrets Manager** for `MONGODB_URI`, `JWT_SECRET`, and AWS credentials (AWS_ACCESS_KEY_ID, etc.).

3. **Deploy Service**:
   - Create a service inside your Cluster.
   - Choose Fargate.
   - Set desired tasks (typically 2 for HA).
   - Configure Load Balancer (ALB) to listen on port 80/443 and route to 3006.

---

## 5. Environment Variables for AWS
| Variable | Suggested AWS Source |
| :--- | :--- |
| `NODE_ENV` | ECS Task Definition (Literal: `production`) |
| `PORT` | ECS Task Definition (Literal: `3006`) |
| `MONGODB_URI` | Secrets Manager (Secure string) |
| `JWT_SECRET` | Secrets Manager (Secure string) |
| `AWS_ACCESS_KEY_ID` | IAM Role for ECS Task (Avoid hardcoding) |
| `AWS_SECRET_ACCESS_KEY`| IAM Role for ECS Task (Avoid hardcoding) |

> [!TIP]
> **Security Best Practice**: Instead of using manual AWS credentials in your environment variables, attach an **IAM Role** to your ECS Task with `AmazonS3FullAccess` (or scoped policy). The AWS SDK in your backend will automatically detect and use this role.
