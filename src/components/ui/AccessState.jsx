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
    <main className={`theme-container auth-page ${className}`} {...props}>
      <Card
        ref={ref}
        variant="elevated"
        padding="md"
        className="auth-card text-center"
      >
        <div className="auth-copy flex flex-col items-center">
          {statusLabel ? (
            <StatusPill status={statusType} className="mb-3">
              {isLoadingIcon && <LoaderCircle size={14} className="auth-spin" />}
              {!isLoadingIcon && <Icon size={14} />}
              <span>{statusLabel}</span>
            </StatusPill>
          ) : (
            <Icon
              size={34}
              className={`mb-4 mx-auto ${isLoadingIcon ? 'auth-spin' : ''} ${iconColorClass}`}
            />
          )}

          <h1 className="text-2xl font-bold mb-3 text-[var(--auth-text-strong)]">{title}</h1>

          <p className="text-[0.88rem] leading-relaxed mb-6 text-[var(--auth-text-muted)]">
            {description}
          </p>

          {alertMessage && (
            <FeedbackAlert variant="warning" className="text-left w-full mb-6">
              {alertMessage}
            </FeedbackAlert>
          )}
        </div>

        <div className="grid gap-3 w-full">
          {primaryAction && (
            <Button
              variant={primaryAction.variant || 'primary'}
              onClick={primaryAction.onClick}
              className="w-full"
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || 'secondary'}
              onClick={secondaryAction.onClick}
              className="w-full"
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
