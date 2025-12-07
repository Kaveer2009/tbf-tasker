self.addEventListener('push', function(event) {
  let data = { title: 'TaskManager', body: 'You have a notification' };
  if (event.data) data = event.data.json();
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/employee.html'));
});