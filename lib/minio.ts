import { Client as MinioClient } from "minio"

const DEFAULT_UPLOAD_URL_EXPIRY_SECONDS = 60 * 5
const DEFAULT_DOWNLOAD_URL_EXPIRY_SECONDS = 60

type MinioConfig = {
  endpoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucket: string
}

let cachedClient: MinioClient | null = null
let cachedConfig: MinioConfig | null = null

const parseBoolean = (value: string | undefined): boolean => {
  if (!value) return false
  return value === "1" || value.toLowerCase() === "true"
}

const getConfig = (): MinioConfig => {
  if (cachedConfig) return cachedConfig

  const endpoint = process.env.MINIO_ENDPOINT?.trim()
  const accessKey = process.env.MINIO_ACCESS_KEY?.trim()
  const secretKey = process.env.MINIO_SECRET_KEY?.trim()
  const bucket =
    process.env.MINIO_PRIVATE_BUCKET?.trim() ??
    process.env.MINIO_DOCUMENTS_BUCKET?.trim() ??
    process.env.MINIO_BUCKET?.trim()
  const port = Number(process.env.MINIO_PORT ?? "9000")
  const useSSL = parseBoolean(process.env.MINIO_USE_SSL)

  if (!endpoint || !accessKey || !secretKey || !bucket || Number.isNaN(port)) {
    throw new Error("MINIO_NOT_CONFIGURED")
  }

  cachedConfig = { endpoint, accessKey, secretKey, bucket, port, useSSL }
  return cachedConfig
}

export const getMinioClient = (): MinioClient => {
  if (cachedClient) return cachedClient

  const config = getConfig()
  cachedClient = new MinioClient({
    endPoint: config.endpoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  })

  return cachedClient
}

export const getMinioPrivateBucket = (): string => getConfig().bucket

export const createPresignedUploadUrl = async (objectKey: string, expirySeconds = DEFAULT_UPLOAD_URL_EXPIRY_SECONDS) => {
  const client = getMinioClient()
  const bucket = getMinioPrivateBucket()
  return client.presignedPutObject(bucket, objectKey, expirySeconds)
}

export const createPresignedDownloadUrl = async (objectKey: string, expirySeconds = DEFAULT_DOWNLOAD_URL_EXPIRY_SECONDS) => {
  const client = getMinioClient()
  const bucket = getMinioPrivateBucket()
  return client.presignedGetObject(bucket, objectKey, expirySeconds)
}

export const deleteObjectFromPrivateBucket = async (objectKey: string): Promise<void> => {
  const client = getMinioClient()
  const bucket = getMinioPrivateBucket()
  await client.removeObject(bucket, objectKey)
}
