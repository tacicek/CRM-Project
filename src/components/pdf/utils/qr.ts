import QRCode from "qrcode";

export const generateQRCode = async (url: string): Promise<string> => {
  return QRCode.toDataURL(url, {
    width: 150,
    margin: 1,
  });
};
