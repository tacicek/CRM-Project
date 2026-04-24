import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const companySchema = z.object({
  company_name: z.string().min(2, "Firmenname muss mindestens 2 Zeichen haben").max(100),
  email: z.string().email("Ungültige E-Mail-Adresse").max(255),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben").max(100),
  phone: z.string().max(20).optional(),
  plz: z.string().min(4, "PLZ muss mindestens 4 Zeichen haben").max(10),
  city: z.string().min(2, "Stadt muss mindestens 2 Zeichen haben").max(100),
  street: z.string().max(200).optional(),
  house_number: z.string().max(20).optional(),
});

interface AddCompanyDialogProps {
  onSuccess: () => void;
}

const AddCompanyDialog = ({ onSuccess }: AddCompanyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    company_name: "",
    email: "",
    password: "",
    phone: "",
    plz: "",
    city: "",
    street: "",
    house_number: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password }));
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = companySchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((error) => {
        if (error.path[0]) {
          fieldErrors[error.path[0] as string] = error.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create user account via edge function
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        toast({
          title: "Nicht angemeldet",
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.functions.invoke(
        "admin-create-user",
        {
          body: {
            email: formData.email,
            password: formData.password,
            firstName: formData.company_name,
            companyName: formData.company_name,
            sendEmail: true,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (userError || userData?.error) {
        throw new Error(userData?.error || userError?.message || "Benutzer konnte nicht erstellt werden");
      }

      const emailSent = userData?.emailSent;

      // Step 2: Create company with the new user_id
      const { data: companyData, error: companyError } = await supabase.from("companies").insert({
        company_name: formData.company_name,
        email: formData.email,
        phone: formData.phone || null,
        plz: formData.plz,
        city: formData.city,
        street: formData.street || null,
        house_number: formData.house_number || null,
        user_id: userData.userId,
        is_active: true,
        is_verified: true, // Auto-verify since admin created it
      }).select().single();

      if (companyError) throw companyError;

      // Step 3: Add all default services for the new company
      const defaultServices = [
        "umzug",
        "reinigung", 
        "renovation",
        "entsorgung",
        "malerarbeiten",
        "klaviertransport",
        "lagerung",
        "moebellift",
      ];

      const serviceInserts = defaultServices.map((serviceType) => ({
        company_id: companyData.id,
        service_type: serviceType,
        is_active: true,
      }));

      const { error: servicesError } = await supabase
        .from("company_services")
        .insert(serviceInserts);

      if (servicesError) {
        console.error("Error adding default services:", servicesError);
        // Don't throw - company is created, services can be added manually
      }

      // Step 4: Add default PLZ coverage with 50km radius
      const { error: plzError } = await supabase
        .from("company_plz_coverage")
        .insert({
          company_id: companyData.id,
          plz: formData.plz,
          radius_km: 50, // Default 50km radius
          is_active: true,
        });

      if (plzError) {
        console.error("Error adding default PLZ coverage:", plzError);
        // Don't throw - company is created, PLZ can be added manually
      }

      toast({
        title: "Firma erstellt",
        description: (
          <div className="space-y-2">
            <p><strong>{formData.company_name}</strong> wurde erfolgreich erstellt.</p>
            <p className="text-sm text-muted-foreground">
              ✅ Alle Dienstleistungen aktiviert<br />
              ✅ PLZ {formData.plz} mit 50km Radius hinzugefügt
            </p>
            {emailSent ? (
              <p className="text-sm text-accent">✅ Login-Daten wurden per E-Mail gesendet.</p>
            ) : (
              <div className="bg-muted p-3 rounded-md text-sm mt-2">
                <p><strong>Login-Daten:</strong></p>
                <p>E-Mail: {formData.email}</p>
                <p>Passwort: {formData.password}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  (E-Mail nicht gesendet - RESEND_API_KEY fehlt)
                </p>
              </div>
            )}
          </div>
        ),
        duration: emailSent ? 5000 : 15000,
      });

      setFormData({
        company_name: "",
        email: "",
        password: "",
        phone: "",
        plz: "",
        city: "",
        street: "",
        house_number: "",
      });
      setOpen(false);
      onSuccess();
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "Firma konnte nicht hinzugefügt werden.";
      console.error("Error adding company:", error);
      
      // Translate common error messages to German
      let errorMessage = rawMessage;
      if (rawMessage.includes("already been registered") || rawMessage.includes("already exists")) {
        errorMessage = "Diese E-Mail-Adresse ist bereits registriert. Bitte verwenden Sie eine andere E-Mail.";
      }
      
      toast({
        title: "Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Firma hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Neue Firma hinzufügen</DialogTitle>
          <DialogDescription>
            Erstelle eine neue Firma mit Login-Zugangsdaten.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Firmenname *</Label>
            <Input
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Musterfirma GmbH"
            />
            {errors.company_name && (
              <p className="text-sm text-destructive">{errors.company_name}</p>
            )}
          </div>

          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Login-Zugangsdaten</p>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail (Login) *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="kontakt@firma.ch"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mindestens 8 Zeichen"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={generatePassword}>
                Generieren
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+41 44 123 45 67"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plz">PLZ *</Label>
              <Input
                id="plz"
                name="plz"
                value={formData.plz}
                onChange={handleChange}
                placeholder="8000"
              />
              {errors.plz && (
                <p className="text-sm text-destructive">{errors.plz}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Stadt *</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Zürich"
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="street">Strasse</Label>
              <Input
                id="street"
                name="street"
                value={formData.street}
                onChange={handleChange}
                placeholder="Musterstrasse"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="house_number">Nr.</Label>
              <Input
                id="house_number"
                name="house_number"
                value={formData.house_number}
                onChange={handleChange}
                placeholder="12"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Firma erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCompanyDialog;
