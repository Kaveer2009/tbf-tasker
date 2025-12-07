const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cron = require('node-cron');
admin.initializeApp();
const db = admin.firestore();

// HTTPS function to send notification to a user by uid
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  try {
    const { uid, title, body, taskId } = req.body;
    if (!uid) return res.status(400).send('uid required');

    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return res.status(404).send('user not found');
    const token = userSnap.data().fcmToken;
    if (!token) return res.status(400).send('no token');

    const payload = { notification: { title, body }, data: { taskId: taskId || '' } };
    const r = await admin.messaging().sendToDevice(token, payload);
    return res.send({ result: r });
  } catch (e) { console.error(e); return res.status(500).send(e.message); }
});

// Scheduled function: hourly reminders (runs every hour)
exports.hourlyReminder = functions.pubsub.schedule('every 60 minutes').onRun(async (context) => {
  console.log('Hourly reminder triggered');
  // Find tasks still pending and due within next 24 hours or simply pending
  const now = admin.firestore.Timestamp.now();
  const pendingSnap = await db.collection('tasks').where('status','==','pending').get();
  const sendPromises = [];
  pendingSnap.forEach(doc => {
    const data = doc.data();
    // example: remind only if task exists and assignedTo present
    if (data.assignedTo) {
      sendPromises.push(sendToUser(data.assignedTo, `Pending: ${data.title}`, `Task is still pending`));
    }
  });
  await Promise.all(sendPromises);
  return null;
});

// Scheduled function: daily summary at 20:00 UTC (adjust for your timezone)
exports.dailySummary = functions.pubsub.schedule('0 20 * * *').timeZone('Asia/Kolkata').onRun(async (context) => {
  console.log('Daily summary triggered');
  const pendingSnap = await db.collection('tasks').where('status','==','pending').get();
  const byUser = {};
  pendingSnap.forEach(doc => {
    const data = doc.data();
    if (!data.assignedTo) return;
    byUser[data.assignedTo] = byUser[data.assignedTo] || [];
    byUser[data.assignedTo].push(data.title);
  });
  const promises = [];
  for (const uid of Object.keys(byUser)) {
    const titles = byUser[uid].slice(0,10).join(', ');
    promises.push(sendToUser(uid, 'Daily pending tasks', `Pending: ${titles}`));
  }
  await Promise.all(promises);
  return null;
});

async function sendToUser(uid, title, body){
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return;
    const token = userSnap.data().fcmToken;
    if (!token) return;
    const payload = { notification: { title, body } };
    return admin.messaging().sendToDevice(token, payload);
  } catch(e){ console.error('sendToUser err', e); }
}