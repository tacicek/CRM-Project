export interface CrmAccessCompany {
  crm_enabled?: boolean | null;
  subscription_type?: string | null;
  subscription_expires_at?: string | null;
}

/** Returns true if the company has active CRM or trial access. */
export const checkCrmAccess = (company: CrmAccessCompany): boolean => {
  if (!company.crm_enabled) return false;
  const type = company.subscription_type ?? "";
  if (type !== "crm" && type !== "trial" && type !== "enterprise") return false;
  if (company.subscription_expires_at) {
    if (new Date(company.subscription_expires_at) < new Date()) return false;
  }
  return true;
};
