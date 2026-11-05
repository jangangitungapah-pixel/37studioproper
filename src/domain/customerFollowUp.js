function jakartaBusinessDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).format(value);
}

function compareDueTasks(first, second) {
  const dueOrder = String(first.dueAt || '').localeCompare(String(second.dueAt || ''));
  if (dueOrder) return dueOrder;
  const timeOrder = String(first.dueTime || '').localeCompare(String(second.dueTime || ''));
  if (timeOrder) return timeOrder;
  const createdOrder = String(first.createdAt || '').localeCompare(String(second.createdAt || ''));
  return createdOrder || String(first.id || '').localeCompare(String(second.id || ''));
}

export function getCustomerFollowUpBuckets(tasks = [], now = new Date()) {
  const today = jakartaBusinessDate(now);
  const active = [];
  const completed = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!task || task.status === 'cancelled') continue;
    if (task.status === 'completed') completed.push(task);
    else active.push(task);
  }

  const overdue = [];
  const dueToday = [];
  const upcoming = [];

  for (const task of active) {
    const dueDate = String(task.dueAt || '').slice(0, 10);
    if (dueDate < today) overdue.push(task);
    else if (dueDate === today) dueToday.push(task);
    else upcoming.push(task);
  }

  overdue.sort(compareDueTasks);
  dueToday.sort(compareDueTasks);
  upcoming.sort(compareDueTasks);
  completed.sort((first, second) => {
    const completedOrder = String(second.completedAt || '').localeCompare(String(first.completedAt || ''));
    return completedOrder || String(first.id || '').localeCompare(String(second.id || ''));
  });

  return { overdue, dueToday, upcoming, completed, businessDate: today };
}
