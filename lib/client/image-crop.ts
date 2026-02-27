"use client"

export type ImageCropEditorSource = {
  objectUrl: string
  naturalWidth: number
  naturalHeight: number
}

export type ImageCropEditorLayout = {
  displayScale: number
  scaledWidth: number
  scaledHeight: number
  maxOffsetX: number
  maxOffsetY: number
  clampedOffsetX: number
  clampedOffsetY: number
  imageLeft: number
  imageTop: number
}

export const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const disposeImageCropEditorSource = (source: ImageCropEditorSource | null): void => {
  if (!source) {
    return
  }

  URL.revokeObjectURL(source.objectUrl)
}

export const loadImageCropEditorSource = async (file: File): Promise<ImageCropEditorSource> => {
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Failed to decode image"))
      image.src = objectUrl
    })
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }

  return {
    objectUrl,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  }
}

export const getImageCropEditorLayout = (params: {
  source: ImageCropEditorSource
  zoom: number
  offsetX: number
  offsetY: number
  viewportSize: number
}): ImageCropEditorLayout => {
  const baseScale = Math.max(params.viewportSize / params.source.naturalWidth, params.viewportSize / params.source.naturalHeight)
  const displayScale = baseScale * params.zoom
  const scaledWidth = params.source.naturalWidth * displayScale
  const scaledHeight = params.source.naturalHeight * displayScale
  const maxOffsetX = Math.max(0, (scaledWidth - params.viewportSize) / 2)
  const maxOffsetY = Math.max(0, (scaledHeight - params.viewportSize) / 2)
  const clampedOffsetX = clampNumber(params.offsetX, -maxOffsetX, maxOffsetX)
  const clampedOffsetY = clampNumber(params.offsetY, -maxOffsetY, maxOffsetY)
  const imageLeft = (params.viewportSize - scaledWidth) / 2 + clampedOffsetX
  const imageTop = (params.viewportSize - scaledHeight) / 2 + clampedOffsetY

  return {
    displayScale,
    scaledWidth,
    scaledHeight,
    maxOffsetX,
    maxOffsetY,
    clampedOffsetX,
    clampedOffsetY,
    imageLeft,
    imageTop,
  }
}

export const clampImageCropOffsetsForZoom = (params: {
  source: ImageCropEditorSource
  zoom: number
  viewportSize: number
  offsetX: number
  offsetY: number
}): { offsetX: number; offsetY: number } => {
  const baseScale = Math.max(params.viewportSize / params.source.naturalWidth, params.viewportSize / params.source.naturalHeight)
  const scaledWidth = params.source.naturalWidth * baseScale * params.zoom
  const scaledHeight = params.source.naturalHeight * baseScale * params.zoom
  const maxOffsetX = Math.max(0, (scaledWidth - params.viewportSize) / 2)
  const maxOffsetY = Math.max(0, (scaledHeight - params.viewportSize) / 2)

  return {
    offsetX: clampNumber(params.offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clampNumber(params.offsetY, -maxOffsetY, maxOffsetY),
  }
}

export const renderCroppedImageDataUrl = async (params: {
  source: ImageCropEditorSource
  layout: ImageCropEditorLayout
  viewportSize: number
  outputSize: number
  mimeType?: "image/jpeg" | "image/png" | "image/webp"
  quality?: number
}): Promise<string> => {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Failed to prepare cropped image."))
    image.src = params.source.objectUrl
  })

  const canvas = document.createElement("canvas")
  canvas.width = params.outputSize
  canvas.height = params.outputSize

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Failed to process selected image.")
  }

  const sourceSide = params.viewportSize / params.layout.displayScale
  const rawSourceX = (0 - params.layout.imageLeft) / params.layout.displayScale
  const rawSourceY = (0 - params.layout.imageTop) / params.layout.displayScale
  const maxSourceX = Math.max(0, params.source.naturalWidth - sourceSide)
  const maxSourceY = Math.max(0, params.source.naturalHeight - sourceSide)
  const sourceX = clampNumber(rawSourceX, 0, maxSourceX)
  const sourceY = clampNumber(rawSourceY, 0, maxSourceY)

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSide,
    sourceSide,
    0,
    0,
    params.outputSize,
    params.outputSize
  )

  return canvas.toDataURL(params.mimeType ?? "image/jpeg", params.quality ?? 0.92)
}
