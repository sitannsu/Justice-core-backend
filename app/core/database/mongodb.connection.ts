import mongoose from 'mongoose';
import { databaseConfig } from '../../config/database.config';

class MongoDBConnection {
  private static instance: MongoDBConnection;
  private isConnected: boolean = false;
  private retryAttempts: number = 0;
  private maxRetries: number = 3;

  private constructor() {
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      this.isConnected = false;
    });

    process.on('SIGINT', this.closeConnection.bind(this));
    process.on('SIGTERM', this.closeConnection.bind(this));
  }

  public static getInstance(): MongoDBConnection {
    if (!MongoDBConnection.instance) {
      MongoDBConnection.instance = new MongoDBConnection();
    }
    return MongoDBConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log('Already connected to MongoDB');
        return;
      }

      await mongoose.connect(databaseConfig.mongodb.url, databaseConfig.mongodb.options);
      this.retryAttempts = 0;
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        console.log(`Retrying connection attempt ${this.retryAttempts}/${this.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.connect();
      }
      
      throw new Error('Failed to connect to MongoDB after multiple attempts');
    }
  }

  public async closeConnection(): Promise<void> {
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
      this.isConnected = false;
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
      throw error;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getMongoose(): typeof mongoose {
    return mongoose;
  }

  public async runTransaction<T>(
    callback: (session: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const db = MongoDBConnection.getInstance();
