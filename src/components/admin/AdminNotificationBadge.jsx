import React from 'react';

function getNotificationBadgeCount(summary) {
  return Math.max(0, Number(summary?.failed || 0) + Number(summary?.pending || 0));
}

function getNotificationBadgeTone(summary) {
  if (Number(summary?.failed || 0) > 0) return 'danger';
  if (Number(summary?.pending || 0) > 0) return 'warning';
  if (Number(summary?.processing || 0) > 0) return 'info';

  return 'quiet';
}

function getNotificationBadgeText(summary) {
  const count = getNotificationBadgeCount(summary);

  if (count > 99) return '99+';
  if (count > 0) return String(count);
  if (Number(summary?.processing || 0) > 0) return '•';

  return '';
}

function getNotificationBadgeLabel(summary) {
  const failed = Number(summary?.failed || 0);
  const pending = Number(summary?.pending || 0);
  const processing = Number(summary?.processing || 0);

  if (failed > 0 && pending > 0) {
    return `${failed} notifikasi gagal dan ${pending} notifikasi pending`;
  }

  if (failed > 0) {
    return `${failed} notifikasi gagal perlu dicek`;
  }

  if (pending > 0) {
    return `${pending} notifikasi pending menunggu Worker`;
  }

  if (processing > 0) {
    return `${processing} notifikasi sedang diproses`;
  }

  return 'Tidak ada notifikasi bermasalah';
}

export default function AdminNotificationBadge({ summary, variant = 'nav' }) {
  const text = getNotificationBadgeText(summary);

  if (!text) return null;

  const tone = getNotificationBadgeTone(summary);

  return (
    <span
      aria-label={getNotificationBadgeLabel(summary)}
      className={`admin-notification-badge is-${tone} is-${variant}`}
      title={getNotificationBadgeLabel(summary)}
    >
      {text}
    </span>
  );
}
