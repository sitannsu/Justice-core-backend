const Document = require('../models/Document');
const Case = require('../models/Case');
const User = require('../models/User');

class StatsService {
  // Get overall system statistics
  async getOverallStats(userId) {
    try {
      // Find all cases owned by this lawyer
      const caseIds = await Case.find({ lawyer: userId }).select('_id');
      const idList = caseIds.map((c) => c._id);

      // Get document statistics
      const documentStats = await this.getDocumentStats(userId, idList);
      
      // Get case statistics
      const caseStats = await this.getCaseStats(userId, idList);
      
      // Get user statistics
      const userStats = await this.getUserStats(userId);

      return {
        documents: documentStats,
        cases: caseStats,
        user: userStats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting overall stats:', error);
      throw error;
    }
  }

  // Get document statistics
  async getDocumentStats(userId, caseIds) {
    try {
      const documents = await Document.find({
        case: { $in: caseIds },
        status: { $ne: 'deleted' }
      });

      const totalFiles = documents.length;
      const totalSizeBytes = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
      const limitBytes = 5 * 1024 * 1024 * 1024; // 5 GB
      const usedPercent = Math.min(100, Math.round((totalSizeBytes / limitBytes) * 100));
      const totalGptQueries = documents.reduce((sum, doc) => sum + (doc.gptQueries || 0), 0);

      // File type breakdown
      const fileTypeBreakdown = documents.reduce((acc, doc) => {
        const category = doc.fileCategory || 'other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      // Recent activity
      const recentUploads = documents
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(doc => ({
          id: doc._id,
          name: doc.originalName,
          uploadedAt: doc.createdAt,
          uploadedBy: doc.uploadedBy,
          caseId: doc.case
        }));

      return {
        totalFiles,
        totalSizeBytes,
        totalSizeFormatted: this.formatBytes(totalSizeBytes),
        limitBytes,
        usedPercent,
        remainingBytes: Math.max(limitBytes - totalSizeBytes, 0),
        totalGptQueries,
        fileTypeBreakdown,
        recentUploads,
        averageFileSize: totalFiles > 0 ? Math.round(totalSizeBytes / totalFiles) : 0
      };
    } catch (error) {
      console.error('Error getting document stats:', error);
      throw error;
    }
  }

  // Get case statistics
  async getCaseStats(userId, caseIds) {
    try {
      const cases = await Case.find({ _id: { $in: caseIds } });
      
      const totalCases = cases.length;
      const activeCases = cases.filter(c => c.status === 'active').length;
      const completedCases = cases.filter(c => c.status === 'completed').length;
      const pendingCases = cases.filter(c => c.status === 'pending').length;

      // Case stage breakdown
      const stageBreakdown = cases.reduce((acc, c) => {
        const stage = c.caseStage || 'unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {});

      return {
        totalCases,
        activeCases,
        completedCases,
        pendingCases,
        stageBreakdown
      };
    } catch (error) {
      console.error('Error getting case stats:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      // Get user's activity in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentDocuments = await Document.countDocuments({
        uploadedBy: userId,
        createdAt: { $gte: thirtyDaysAgo }
      });

      const recentGptQueries = await Document.aggregate([
        {
          $match: {
            uploadedBy: userId,
            lastGptQuery: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalQueries: { $sum: '$gptQueries' }
          }
        }
      ]);

      return {
        userId: user._id,
        email: user.email,
        role: user.role || 'lawyer',
        recentDocuments,
        recentGptQueries: recentGptQueries[0]?.totalQueries || 0,
        lastActivity: user.lastLogin || user.createdAt
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Update stats when document is uploaded
  async updateStatsOnDocumentUpload(userId, documentData) {
    try {
      // This could trigger real-time updates or cache invalidation
      console.log(`Stats updated for user ${userId} - new document uploaded`);
      return true;
    } catch (error) {
      console.error('Error updating stats on document upload:', error);
      return false;
    }
  }

  // Update stats when GPT query is made
  async updateStatsOnGptQuery(userId, documentId, queryCount) {
    try {
      // This could trigger real-time updates or cache invalidation
      console.log(`Stats updated for user ${userId} - GPT query count increased by ${queryCount}`);
      return true;
    } catch (error) {
      console.error('Error updating stats on GPT query:', error);
      return false;
    }
  }

  // Format bytes to human readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get storage usage percentage
  getStorageUsagePercentage(usedBytes, limitBytes = 5 * 1024 * 1024 * 1024) {
    return Math.min(100, Math.round((usedBytes / limitBytes) * 100));
  }
}

module.exports = new StatsService();
