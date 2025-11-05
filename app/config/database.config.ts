import dotenv from 'dotenv';

dotenv.config();

export const databaseConfig = {
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/legalplatform',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  }
};
