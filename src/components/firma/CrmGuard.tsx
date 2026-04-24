// CRM-FORK: In the standalone single-tenant CRM, all routes are always accessible.
// This guard is kept as a no-op wrapper so imports from other files do not break.
import { ReactNode } from "react";

interface CrmGuardProps {
  children: ReactNode;
}

const CrmGuard = ({ children }: CrmGuardProps) => <>{children}</>;

export default CrmGuard;
