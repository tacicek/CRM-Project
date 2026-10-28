import type { Database } from '@/integrations/supabase/types';

type Direction = 'from' | 'to';
type AddressField = 'street' | 'house_number' | 'plz' | 'city' | 'floor' | 'has_lift';
type FrozenFields = `frozen_${Direction}_${AddressField}`;
type LeadFields = `${Direction}_${AddressField}`;

export type OfferAddressSource = Partial<Pick<Database['public']['Tables']['offers']['Row'], FrozenFields>> & {
  leads?: Partial<Pick<Database['public']['Tables']['leads']['Row'], LeadFields>> | null;
};

/** One address is one snapshot: never attach a current lead's number or access
 * details to an older frozen street. Only an uncaptured address uses the lead. */
export const getOfferAddressSnapshot = (offer: OfferAddressSource, direction: Direction) => {
  const frozen = {
    street: offer[`frozen_${direction}_street`] ?? null,
    house_number: offer[`frozen_${direction}_house_number`] ?? null,
    plz: offer[`frozen_${direction}_plz`] ?? null,
    city: offer[`frozen_${direction}_city`] ?? null,
  };
  const hasSnapshot = Object.values(frozen).some(value => value !== null);
  return hasSnapshot ? {
    ...frozen,
    floor: offer[`frozen_${direction}_floor`] ?? null,
    has_lift: offer[`frozen_${direction}_has_lift`] ?? null,
  } : {
    street: offer.leads?.[`${direction}_street`] ?? null,
    house_number: offer.leads?.[`${direction}_house_number`] ?? null,
    plz: offer.leads?.[`${direction}_plz`] ?? null,
    city: offer.leads?.[`${direction}_city`] ?? null,
    floor: offer.leads?.[`${direction}_floor`] ?? null,
    has_lift: offer.leads?.[`${direction}_has_lift`] ?? null,
  };
};
