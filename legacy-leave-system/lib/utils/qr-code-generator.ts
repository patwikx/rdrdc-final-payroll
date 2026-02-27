import QRCode from 'qrcode'

export interface QRCodeData {
  itemCode: string
  description: string
  serialNumber?: string
  businessUnitId: string
  assetId: string
}

export async function generateQRCode(data: QRCodeData): Promise<string> {
  try {
    // Create a direct URL to the public asset details page (no login required)
    const baseUrl = process.env.AUTH_URL || 'http://localhost:3000'
    const qrData = `${baseUrl}/public/assets/${data.assetId}`

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    })

    return qrCodeDataURL
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw new Error('Failed to generate QR code')
  }
}

export async function generateQRCodeBuffer(data: QRCodeData): Promise<Buffer> {
  try {
    // Create a direct URL to the public asset details page (no login required)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const qrData = `${baseUrl}/public/assets/${data.assetId}`

    const buffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    })

    return buffer
  } catch (error) {
    console.error('Error generating QR code buffer:', error)
    throw new Error('Failed to generate QR code')
  }
}