import { AlertTriangle, ArrowRight, LoaderCircle, ShieldCheck, X } from 'lucide-react';

export default function AccountRoleDecisionDialog({
  badge = 'Akses akun',
  title,
  message,
  detail = '',
  actions = [],
  isBusy = false,
}) {
  if (!title) return null;

  return (
    <div className="account-role-overlay" role="presentation">
      <section
        className="account-role-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-role-dialog-title"
        aria-describedby="account-role-dialog-description"
      >
        <div className="account-role-icon" aria-hidden="true">
          <AlertTriangle size={24} />
        </div>
        <span className="account-role-badge">
          <ShieldCheck size={13} />
          {badge}
        </span>
        <h2 id="account-role-dialog-title">{title}</h2>
        <p id="account-role-dialog-description">{message}</p>
        {detail ? <div className="account-role-detail">{detail}</div> : null}
        <div className="account-role-actions">
          {actions.map((action, index) => {
            const Icon = action.icon === 'close' ? X : ArrowRight;
            return (
              <button
                key={action.key || action.label}
                type="button"
                className={`account-role-action ${index === 0 ? 'is-primary' : 'is-secondary'}`}
                onClick={action.onClick}
                disabled={isBusy || action.disabled}
              >
                {isBusy && index === 0 ? <LoaderCircle className="auth-spin" size={16} /> : <Icon size={16} />}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
