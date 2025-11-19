import dotenv from 'dotenv';

dotenv.config();

export const databaseConfig = {
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://adminUser:Admin12345@3.109.112.149:27017/legalplatform',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  }
};
