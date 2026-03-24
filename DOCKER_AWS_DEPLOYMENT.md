# 🐳 Justice Core Backend: Docker & AWS Master Guide

This guide details how to use the Docker ecosystem and deploy your application to AWS easily.

---

## 🚀 1. Quick Start (Local Development)

### **One-command Start**
Wait for MongoDB, start the backend, and access the Database UI.
```bash
docker-compose up -d
```

### **Services & Access**
- **Backend API**: [http://localhost:3006](http://localhost:3006)
- **Health Check**: [http://localhost:3006/health](http://localhost:3006/health)
- **MongoDB Web UI**: [http://localhost:8081](http://localhost:8081)
  - *Login*: admin / pass
- **Direct MongoDB Access**: `mongodb://localhost:27017`

---

## 🛠️ 2. Docker Setup Details

### **Dockerfile (Multi-Stage)**
- Uses `node:18-alpine` for a lightweight and secure image.
- Uses `tini` for proper signal handling (prevents zombie processes).
- Features a multi-stage build to keep the final image minimal by excluding build tools.
- Runs as a **non-root user** (`justice`) for improved security.

### **Docker Compose (Local Orchestration)**
- **Isolated Network**: Services communicate over a private bridge network.
- **Health Checks**: Containers wait until MongoDB is ready before starting the backend.
- **Persistent Data**: Database data is stored in the `mongo-data` volume so it's not lost when containers stopped.

---

## ☁️ 3. AWS Deployment Workflow

The easiest way to deploy this Dockerized app to AWS is using **Elastic Container Service (ECS)** with **Fargate (Serverless)**.

### **Step 1: ECR (Registry)**
Store your image on AWS ECR:
```bash
# Authenticate (replace YOUR_AWS_ACCOUNT_ID)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and Tag
docker build -t justice-core-backend .
docker tag justice-core-backend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/justice-core-backend:latest

# Push
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/justice-core-backend:latest
```

### **Step 2: ECS + Fargate Deployment**
1. **Cluster**: Create an ECS Cluster (Choose "Networking Only" for Fargate).
2. **Task Definition**:
   - Launch type: **Fargate**.
   - Memory: 0.5 GB, CPU: 0.25 vCPU (minimal for costs).
   - Container Image: `YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/justice-core-backend:latest`.
   - **Environment Variables**: Add your `.env` variables (use **AWS Secrets Manager** for `MONGODB_URI`).
3. **Service**:
   - Create a Service in your cluster for your Task Definition.
   - Choose a **Load Balancer (ALB)** to handle traffic and SSL.

---

## 🗄️ 4. MongoDB in AWS
For a production-ready backend in AWS, do **NOT** run MongoDB in an ECS container, as managing stateful containers is complex.

### **Recommended Option: MongoDB Atlas** (Easiest)
1. Create a free/dedicated cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Get the connection string.
3. Replace the `MONGODB_URI` environment variable in AWS ECS.

### **Alternative: AWS DocumentDB**
AWS's native MongoDB-compatible database service.

---

## ⚙️ 5. Troubleshooting
- **Check container logs**: `docker logs -f justice-core-backend`
- **Rebuild from scratch**: `docker-compose build --no-cache`
- **Cleanup everything**: `docker-compose down -v` (removes data too!)
