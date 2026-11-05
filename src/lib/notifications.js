import { toast } from 'sonner';

/**
 * App-facing notification API. Call only after the associated operation has
 * actually completed; rejected operations should use error().
 */
export const studioToast = Object.freeze({
  success(message, options) {
    return toast.success(message, options);
  },
  error(message, options) {
    return toast.error(message, options);
  },
  info(message, options) {
    return toast.info(message, options);
  },
  warning(message, options) {
    return toast.warning(message, options);
  },
  dismiss(id) {
    return toast.dismiss(id);
  },
});
