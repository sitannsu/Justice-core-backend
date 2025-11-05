# Justice Core Backend

Backend API for justice-core-suite frontend

## Features

- User authentication and authorization
- Case management
- Task management
- Event management
- Invoice management
- Location tracking API
- Google Calendar integration

## API Endpoints

### Location API (No Authentication Required)
- `POST /api/location` - Update/create location
- `GET /api/location` - Get all locations
- `GET /api/location/list` - Get paginated locations with details
- `GET /api/location/user/:userId` - Get locations by user
- `GET /api/location/user/:userId/latest` - Get latest location for user

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

## Quick Deploy

### Railway (Recommended)
1. Fork this repository
2. Go to [Railway](https://railway.app)
3. Connect your GitHub account
4. Click "New Project" → "Deploy from GitHub repo"
5. Select your forked repository
6. Add environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Your JWT secret key
   - `PORT`: Railway will set this automatically

### Render
1. Fork this repository
2. Go to [Render](https://render.com)
3. Connect your GitHub account
4. Click "New" → "Web Service"
5. Select your forked repository
6. Set build command: `npm install`
7. Set start command: `npm start`
8. Add environment variables as above

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-secret-key
PORT=3006
```

## Database

This application uses MongoDB. Make sure to:
1. Set up a MongoDB database (MongoDB Atlas recommended)
2. Update the `MONGODB_URI` environment variable
3. The application will automatically create collections as needed

## Notes
- Only the `/api/cases` endpoint is connected to MongoDB. Others are placeholders for future implementation. 