import { forwardRef } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Card from './Card';
import StatusPill from './StatusPill';
import Button from './Button';
import FeedbackAlert from './FeedbackAlert';

const AccessState = forwardRef(function AccessState(
  {
    icon: Icon = AlertCircle,
    iconColorClass = 'text-accent',
    statusLabel,
    statusType = 'neutral',
    title,
    description,
    alertMessage,
    primaryAction,
    secondaryAction,
    className = '',
    isLoadingIcon = false,
    ...props
  },
  ref
) {
  return (
    <main className={`theme-container auth-page studio-access-page ${className}`} {...props}>
      <Card
        ref={ref}
        variant="elevated"
        padding="md"
        className="auth-card studio-access-card"
      >
        <div className="auth-copy studio-access-copy">
          {statusLabel ? (
            <StatusPill status={statusType}>
              {isLoadingIcon && <LoaderCircle size={14} className="auth-spin" />}
              {!isLoadingIcon && <Icon size={14} />}
              <span>{statusLabel}</span>
            </StatusPill>
          ) : (
            <span className={`studio-access-icon ${iconColorClass}`}>
              <Icon size={26} className={isLoadingIcon ? 'auth-spin' : ''} />
            </span>
          )}

          <h1>{title}</h1>

          <div className="studio-access-description">{description}</div>

          {alertMessage && (
            <FeedbackAlert variant="warning">
              {alertMessage}
            </FeedbackAlert>
          )}
        </div>

        <div className="studio-access-actions">
          {primaryAction && (
            <Button
              variant={primaryAction.variant || 'primary'}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || 'secondary'}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
});

export default AccessState;
