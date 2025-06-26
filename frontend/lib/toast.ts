import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

export const toast = ({ title, description, variant = "default", duration }: ToastOptions) => {
  const message = title || "";
  const options = {
    description,
    duration,
  };

  if (variant === "destructive") {
    return sonnerToast.error(message, options);
  }

  return sonnerToast.success(message, options);
};

export const useToast = () => {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
  };
};