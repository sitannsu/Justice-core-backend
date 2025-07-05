const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Case = require('../models/Case');
const Person = require('../models/Person');
const Task = require('../models/Task');
const Invoice = require('../models/Invoice');
const Event = require('../models/Event');

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
      }
    });
  } catch (error) {
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

module.exports = router;
