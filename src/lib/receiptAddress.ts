/** Join the separately stored fields without parsing or rewriting an authored address. */
export const formatReceiptStreet = (street?: string | null, houseNumber?: string | null): string =>
  [street, houseNumber].filter(Boolean).join(' ');

export const formatReceiptAddress = (address: {
  street?: string | null;
  house_number?: string | null;
  plz?: string | null;
  city?: string | null;
}): string => [
  formatReceiptStreet(address.street, address.house_number),
  [address.plz, address.city].filter(Boolean).join(' '),
].filter(Boolean).join(', ');
