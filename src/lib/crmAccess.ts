export interface CrmAccessCompany {
  crm_enabled?: boolean | null;
}

/** Returns true if the company has CRM access enabled. */
export const checkCrmAccess = (company: CrmAccessCompany): boolean => {
  return company.crm_enabled === true;
};
