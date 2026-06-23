import { forwardRef } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import '../../styles/modules/shared.css';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const FeedbackAlert = forwardRef(function FeedbackAlert(
  { children, variant = 'info', title, className = '', icon: CustomIcon, ...props },
  ref
) {
  const Icon = CustomIcon || ICONS[variant] || Info;
  
  return (
    <div ref={ref} className={`studio-feedback-alert is-${variant} ${className}`} role="alert" {...props}>
      <div className="studio-feedback-icon">
        <Icon size={20} />
      </div>
      <div className="studio-feedback-content">
        {title && <h4 className="studio-feedback-title">{title}</h4>}
        <div className="studio-feedback-desc">{children}</div>
      </div>
    </div>
  );
});

export default FeedbackAlert;
