import { useToast } from "@/hooks/use-toast";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { Check, AlertCircle } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={3000}>
      {toasts.map(function ({ id, title, description, variant, ...props }) {
        const Icon = variant === "destructive" ? AlertCircle : Check;
        
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10">
              <Icon className="w-3 h-3" />
            </div>
            <div className="flex flex-col gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
