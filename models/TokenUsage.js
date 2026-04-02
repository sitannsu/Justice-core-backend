const mongoose = require('mongoose');

const tokenUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  endpoint: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  promptTokens: {
    type: Number,
    required: true,
    default: 0
  },
  completionTokens: {
    type: Number,
    required: true,
    default: 0
  },
  totalTokens: {
    type: Number,
    required: true,
    default: 0
  },
  estimatedCost: {
    type: Number,
    default: 0
  },
  feature: {
    type: String,
    enum: [
      'chat',
      'document_question',
      'document_summary',
      'contract_analysis',
      'contract_generation',
      'contract_comparison',
      'legal_document_generation',
      'judgment_search',
      'judgment_summary',
      'legal_research',
      'document_automation',
      'voice_form_fill',
      'other'
    ],
    default: 'other'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
tokenUsageSchema.index({ userId: 1, createdAt: -1 });
tokenUsageSchema.index({ feature: 1, createdAt: -1 });
tokenUsageSchema.index({ createdAt: -1 });

// Static method to calculate cost based on model
tokenUsageSchema.statics.calculateCost = function(model, promptTokens, completionTokens) {
  // Pricing per 1M tokens (as of 2025)
  const pricing = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
  const inputCost = (promptTokens / 1000000) * modelPricing.input;
  const outputCost = (completionTokens / 1000000) * modelPricing.output;
  return Math.round((inputCost + outputCost) * 1000000) / 1000000; // 6 decimal places
};

// Static method to log token usage
tokenUsageSchema.statics.logUsage = async function(data) {
  const cost = this.calculateCost(data.model, data.promptTokens, data.completionTokens);
  return this.create({
    userId: data.userId,
    endpoint: data.endpoint,
    model: data.model,
    promptTokens: data.promptTokens,
    completionTokens: data.completionTokens,
    totalTokens: data.promptTokens + data.completionTokens,
    estimatedCost: cost,
    feature: data.feature || 'other'
  });
};

// Static method to get usage summary for a user
tokenUsageSchema.statics.getUserSummary = async function(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: null,
        totalPromptTokens: { $sum: '$promptTokens' },
        totalCompletionTokens: { $sum: '$completionTokens' },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        totalCalls: { $sum: 1 }
      }
    }
  ]);

  return result[0] || {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    totalCalls: 0
  };
};

// Static method to get usage by feature
tokenUsageSchema.statics.getUsageByFeature = async function(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$feature',
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        calls: { $sum: 1 }
      }
    },
    { $sort: { totalTokens: -1 } }
  ]);
};

// Static method to get daily usage
tokenUsageSchema.statics.getDailyUsage = async function(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        calls: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = mongoose.model('TokenUsage', tokenUsageSchema);
