const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Case = require('../models/Case');
const Person = require('../models/Person');
const Task = require('../models/Task');
const Invoice = require('../models/Invoice');
const Event = require('../models/Event');
const CaseActivity = require('../models/CaseActivity');
const ChatMessage = require('../models/ChatMessage');
const ChatConversation = require('../models/ChatConversation');

// Get dashboard stats
router.get('/stats', auth, async (req, res) => {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get active cases count
    const activeCasesNow = await Case.countDocuments({ caseStage: { $nin: ['Closed', 'Archived'] } });
    const activeCasesLastMonth = await Case.countDocuments({
      caseStage: { $nin: ['Closed', 'Archived'] },
      dateOpened: { $lt: lastMonth }
    });
    const activeCasesChange = activeCasesLastMonth > 0
      ? Math.round(((activeCasesNow - activeCasesLastMonth) / activeCasesLastMonth) * 100)
      : 0;

    // Get total clients count
    const totalClientsNow = await Person.countDocuments({ role: 'client' });
    const totalClientsLastMonth = await Person.countDocuments({
      role: 'client',
      createdAt: { $lt: lastMonth }
    });
    const totalClientsChange = totalClientsLastMonth > 0
      ? Math.round(((totalClientsNow - totalClientsLastMonth) / totalClientsLastMonth) * 100)
      : 0;

    // Get pending tasks count
    const pendingTasksNow = await Task.countDocuments({ status: 'pending' });
    const pendingTasksLastMonth = await Task.countDocuments({
      status: 'pending',
      createdAt: { $lt: lastMonth }
    });
    const pendingTasksChange = pendingTasksLastMonth > 0
      ? Math.round(((pendingTasksNow - pendingTasksLastMonth) / pendingTasksLastMonth) * 100)
      : 0;

    // Get monthly revenue
    const currentMonthInvoices = await Invoice.find({
      createdAt: { $gte: lastMonth }
    });
    const lastMonthInvoices = await Invoice.find({
      createdAt: {
        $gte: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        $lt: lastMonth
      }
    });
    const monthlyRevenueNow = currentMonthInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const monthlyRevenueLast = lastMonthInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const monthlyRevenueChange = monthlyRevenueLast > 0
      ? Math.round(((monthlyRevenueNow - monthlyRevenueLast) / monthlyRevenueLast) * 100)
      : 0;

    // Get case distribution by type
    const caseDistribution = await Case.aggregate([
      { $group: { _id: "$practiceArea", count: { $sum: 1 } } }
    ]);

    // Get case activity trends (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Start of 6 months ago

    const newCasesTrend = await Case.aggregate([
      {
        $match: {
          dateOpened: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { $month: "$dateOpened" },
          count: { $sum: 1 }
        }
      }
    ]);

    const closedCasesTrend = await Case.aggregate([
      {
        $match: {
          caseStage: "Closed",
          updatedAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { $month: "$updatedAt" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format trends data (simplified for brevity, realistically would map 1-12 to Jan-Dec)
    // We will return raw aggregations for now and simpler counts

    res.json({
      activeCases: {
        count: activeCasesNow,
        change: activeCasesChange
      },
      totalClients: {
        count: totalClientsNow,
        change: totalClientsChange
      },
      pendingTasks: {
        count: pendingTasksNow,
        change: pendingTasksChange
      },
      monthlyRevenue: {
        amount: monthlyRevenueNow,
        change: monthlyRevenueChange
      },
      caseDistribution,
      newCasesTrend,
      closedCasesTrend
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard activity
router.get('/activity', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // First find all cases for this lawyer
    const lawyerCases = await Case.find({ lawyer: userId }).select('_id');
    const caseIds = lawyerCases.map(c => c._id);

    // Find recent activities for these cases
    const activities = await CaseActivity.find({ case: { $in: caseIds } })
      .populate('case', 'caseName caseNumber')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(20);

    // Transform to a cleaner format if needed, but the mobile app likely expects the raw activity objects
    // based on typical patterns. Let's provide a consistent structure.
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      caseName: activity.case ? activity.case.caseName : 'Unknown Case',
      caseId: activity.case ? activity.case._id : null,
      timestamp: activity.createdAt,
      relativeTime: activity.relativeTime, // using the virtual we saw in the model
      icon: activity.icon, // using the virtual
      createdBy: activity.createdBy ? `${activity.createdBy.firstName} ${activity.createdBy.lastName}` : 'System'
    }));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Dashboard activity error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get recent cases
router.get('/recent-cases', auth, async (req, res) => {
  try {
    const cases = await Case.find()
      .sort({ updatedAt: -1 })
      .limit(4)
      .populate('clients', 'firstName lastName companyName');

    const recentCases = cases.map(case_ => ({
      id: case_.caseNumber,
      client: case_.clients[0]?.companyName || `${case_.clients[0]?.firstName} ${case_.clients[0]?.lastName}` || 'No Client',
      type: case_.practiceArea,
      status: case_.caseStage,
      priority: case_.priority || 'Medium'
    }));

    res.json(recentCases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get today's schedule
router.get('/today-schedule', auth, async (req, res) => {
  try {
    // Get today's date in local timezone
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    console.log('Fetching events between:', today, 'and', tomorrow);

    // Find all events for today, regardless of user
    const events = await Event.find({
      date: {
        $gte: today,
        $lt: tomorrow
      }
    })
      .sort({ startTime: 1 })
      .populate('caseId', 'caseName');

    console.log('Found events:', events.length);
    events.forEach(event => {
      console.log('Event:', {
        title: event.title,
        date: event.date,
        userId: event.userId,
        attendees: event.attendees
      });
    });

    const schedule = events.map(event => {
      // Format the date string
      const eventDate = new Date(event.date);
      const formattedStartTime = new Date(eventDate.setHours(...event.startTime.split(':').map(Number))).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const formattedEndTime = new Date(eventDate.setHours(...event.endTime.split(':').map(Number))).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      return {
        id: event._id,
        title: event.title,
        type: event.type,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        location: event.location,
        description: event.description,
        caseTitle: event.caseId?.caseName
      };
    });

    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get upcoming events
router.get('/upcoming-events', auth, async (req, res) => {
  try {
    const now = new Date();
    const events = await Event.find({
      date: { $gte: now },
      $or: [
        { userId: req.user.userId },
        { attendees: req.user.userId }
      ]
    })
      .sort({ date: 1, startTime: 1 })
      .limit(4);

    const upcomingEvents = events.map(event => ({
      time: event.startTime,
      event: event.title,
      type: event.type,
      location: event.location
    }));

    res.json(upcomingEvents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get task progress
router.get('/task-progress', auth, async (req, res) => {
  try {
    const total = await Task.countDocuments({ userId: req.user._id });
    const completed = await Task.countDocuments({ userId: req.user._id, status: 'completed' });
    const overdue = await Task.countDocuments({
      userId: req.user._id,
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' }
    });

    res.json({
      total,
      completed,
      overdue
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get actionable items
router.get('/actionable-items', auth, async (req, res) => {
  try {
    const actionableItems = [];
    const userId = req.user.userId;
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // 1. Deadlines (Tasks due today or overdue)
    const deadlines = await Task.find({
      assignedTo: userId,
      status: { $nin: ['Completed', 'Done', 'Archived'] },
      dueDate: { $lte: todayEnd }
    }).populate('case').sort({ dueDate: 1 }).limit(2);

    deadlines.forEach(task => {
      actionableItems.push({
        id: `deadline-${task._id}`,
        type: 'deadline',
        title: `Deadline: ${task.title}`,
        subtitle: task.case ? task.case.caseName : 'Priority Task',
        meta: task.dueDate < now ? 'OVERDUE' : 'Due Today',
        isUrgent: true,
        actionLabel: 'View Task',
        secondaryActionLabel: 'Snooze',
        route: 'TaskDetails',
        routeParams: { taskId: task._id }
      });
    });

    // 2. Real unread messages
    const unreadMessages = await ChatMessage.find({
      sender: { $ne: userId },
      readBy: { $ne: userId }
    })
      .populate('sender', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(2);

    unreadMessages.forEach(msg => {
      actionableItems.push({
        id: `msg-${msg._id}`,
        type: 'message',
        title: `New Message from ${msg.sender ? msg.sender.firstName : 'Client'}`,
        subtitle: msg.content.length > 50 ? msg.content.substring(0, 47) + '...' : msg.content,
        meta: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionLabel: 'Reply',
        route: 'Chat',
        routeParams: { conversationId: msg.conversation }
      });
    });

    // 3. Overdue Invoices
    const overdueInvoices = await Invoice.find({
      user: userId,
      status: 'Overdue'
    }).populate('client').limit(1);

    overdueInvoices.forEach(inv => {
      actionableItems.push({
        id: `invoice-${inv._id}`,
        type: 'deadline',
        title: `Unpaid Invoice: ${inv.invoiceNumber}`,
        subtitle: inv.client ? (inv.client.companyName || inv.client.contactPerson) : 'Client Invoice',
        meta: `₹${inv.total} Outstanding`,
        isUrgent: true,
        actionLabel: 'Follow Up',
        route: 'InvoicesList'
      });
    });

    // 4. Fallback Mocks if list is too small (for demo purposes)
    if (actionableItems.length < 2) {
      if (actionableItems.length === 0) {
        actionableItems.push({
          id: 'mock-msg-1',
          type: 'message',
          title: 'New Message from Opposing Counsel re: ',
          subtitle: 'Acme Corp Case Review',
          meta: '9:42 AM',
          actionLabel: 'Reply',
          route: 'Chat',
          routeParams: { chatId: 'mock-chat-1' }
        });
      }

      actionableItems.push({
        id: 'mock-sign-1',
        type: 'signature',
        title: 'Document Signature Requested: ',
        subtitle: 'Client Engagement Letter (v2)',
        meta: 'Sent by Sarah Jenkins',
        actionLabel: 'Review & Sign',
        route: 'AddDocument',
        routeParams: { mode: 'sign' }
      });
    }

    res.json(actionableItems);
  } catch (error) {
    console.error('Actionable items error:', error);
    res.status(500).json({ message: 'Failed to fetch actionable items' });
  }
});

module.exports = router;
