/* eslint-disable react-refresh/only-export-components */
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      closeButton
      expand={false}
      duration={5000}
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:shadow-2xl group-[.toaster]:border group-[.toaster]:rounded-xl group-[.toaster]:text-base group-[.toaster]:min-w-[320px] group-[.toaster]:max-w-[420px] group-[.toaster]:px-5 group-[.toaster]:py-4",
          title:
            "group-[.toast]:font-semibold group-[.toast]:text-[15px] group-[.toast]:leading-snug",
          description:
            "group-[.toast]:text-sm group-[.toast]:mt-1 group-[.toast]:leading-relaxed",
          success:
            "group-[.toaster]:!bg-green-50 group-[.toaster]:!border-green-300 group-[.toaster]:!text-green-900",
          error:
            "group-[.toaster]:!bg-red-50 group-[.toaster]:!border-red-300 group-[.toaster]:!text-red-900",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:!border-current group-[.toast]:!opacity-50 hover:group-[.toast]:!opacity-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
