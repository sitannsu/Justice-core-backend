const mongoose = require('mongoose');

const caseActivitySchema = new mongoose.Schema({
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'case_created',
      'case_opened',
      'case_updated',
      'document_uploaded',
      'document_deleted',
      'event_scheduled',
      'event_completed',
      'invoice_created',
      'invoice_sent',
      'payment_received',
      'contact_added',
      'contact_removed',
      'client_added',
      'client_removed',
      'attorney_assigned',
      'attorney_unassigned',
      'status_changed',
      'stage_changed',
      'deadline_set',
      'deadline_met',
      'deadline_missed',
      'note_added',
      'task_created',
      'task_completed',
      'time_entry_added',
      'case_archived',
      'case_restored',
      'custom_event'
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    // Store additional context-specific information
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    documentName: String,
    documentType: String,
    eventDate: Date,
    deadline: Date,
    amount: Number,
    contactName: String,
    attorneyName: String,
    status: String,
    stage: String,
    practiceArea: String,
    office: String,
    notes: String,
    tags: [String]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: [
      'case_management',
      'document_management',
      'billing',
      'scheduling',
      'client_management',
      'attorney_management',
      'compliance',
      'communication',
      'deadlines',
      'tasks',
      'time_tracking',
      'custom'
    ],
    default: 'case_management'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  requiresAction: {
    type: Boolean,
    default: false
  },
  actionRequired: {
    type: String,
    trim: true
  },
  actionDeadline: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    originalName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String
  }]
}, {
  timestamps: true
});

// Index for efficient queries
caseActivitySchema.index({ case: 1, createdAt: -1 });
caseActivitySchema.index({ type: 1 });
caseActivitySchema.index({ category: 1 });
caseActivitySchema.index({ createdBy: 1 });
caseActivitySchema.index({ requiresAction: 1 });
caseActivitySchema.index({ tags: 1 });

// Virtual for formatted date
caseActivitySchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Virtual for formatted time
caseActivitySchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
});

// Virtual for relative time
caseActivitySchema.virtual('relativeTime').get(function() {
  const now = new Date();
  const diffMs = now.getTime() - this.createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
});

// Virtual for activity icon
caseActivitySchema.virtual('icon').get(function() {
  const iconMap = {
    'case_created': '📋',
    'case_opened': '🚀',
    'case_updated': '✏️',
    'document_uploaded': '📄',
    'document_deleted': '🗑️',
    'event_scheduled': '📅',
    'event_completed': '✅',
    'invoice_created': '💰',
    'invoice_sent': '📤',
    'payment_received': '💳',
    'contact_added': '👤',
    'contact_removed': '❌',
    'client_added': '🤝',
    'client_removed': '👋',
    'attorney_assigned': '⚖️',
    'attorney_unassigned': '🔀',
    'status_changed': '🔄',
    'stage_changed': '📊',
    'deadline_set': '⏰',
    'deadline_met': '🎯',
    'deadline_missed': '⚠️',
    'note_added': '📝',
    'task_created': '📋',
    'task_completed': '✅',
    'time_entry_added': '⏱️',
    'case_archived': '📦',
    'case_restored': '🔄',
    'custom_event': '🎯'
  };
  return iconMap[this.type] || '📋';
});

// Virtual for priority color
caseActivitySchema.virtual('priorityColor').get(function() {
  const colorMap = {
    'low': 'text-green-600',
    'medium': 'text-blue-600',
    'high': 'text-orange-600',
    'critical': 'text-red-600'
  };
  return colorMap[this.priority] || 'text-blue-600';
});

// Virtual for category color
caseActivitySchema.virtual('categoryColor').get(function() {
  const colorMap = {
    'case_management': 'bg-blue-100 text-blue-800',
    'document_management': 'bg-green-100 text-green-800',
    'billing': 'bg-purple-100 text-purple-800',
    'scheduling': 'bg-orange-100 text-orange-800',
    'client_management': 'bg-indigo-100 text-indigo-800',
    'attorney_management': 'bg-pink-100 text-pink-800',
    'compliance': 'bg-red-100 text-red-800',
    'communication': 'bg-yellow-100 text-yellow-800',
    'deadlines': 'bg-red-100 text-red-800',
    'tasks': 'bg-cyan-100 text-cyan-800',
    'time_tracking': 'bg-emerald-100 text-emerald-800',
    'custom': 'bg-gray-100 text-gray-800'
  };
  return colorMap[this.category] || 'bg-gray-100 text-gray-800';
});

// Static method to create activity entry
caseActivitySchema.statics.createActivity = function(data) {
  return this.create(data);
};

// Static method to get case timeline
caseActivitySchema.statics.getCaseTimeline = function(caseId, options = {}) {
  const query = { case: caseId };
  
  if (options.type) query.type = options.type;
  if (options.category) query.category = options.category;
  if (options.isPublic !== undefined) query.isPublic = options.isPublic;
  
  return this.find(query)
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate('completedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(options.limit || 100);
};

// Static method to get activities requiring action
caseActivitySchema.statics.getPendingActions = function(caseId) {
  return this.find({
    case: caseId,
    requiresAction: true,
    completedAt: { $exists: false }
  })
  .populate('assignedTo', 'firstName lastName email')
  .sort({ actionDeadline: 1 });
};

// Static method to get recent activities
caseActivitySchema.statics.getRecentActivities = function(caseId, limit = 10) {
  return this.find({ case: caseId })
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Ensure virtual fields are serialized
caseActivitySchema.set('toJSON', { virtuals: true });
caseActivitySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CaseActivity', caseActivitySchema);
