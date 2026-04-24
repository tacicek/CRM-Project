/**
 * CRM Upgrade Page
 * Shown when a company tries to access CRM features without a subscription
 */

import { Helmet } from "react-helmet-async";
import FirmaLayout from "@/components/firma/FirmaLayout";
import { CrmUpgradePrompt } from "@/components/firma/CrmUpgradePrompt";

export default function FirmaCrmUpgrade() {
  return (
    <>
      <Helmet>
        <title>CRM Upgrade | Offerio</title>
      </Helmet>
      <FirmaLayout>
        <CrmUpgradePrompt />
      </FirmaLayout>
    </>
  );
}

