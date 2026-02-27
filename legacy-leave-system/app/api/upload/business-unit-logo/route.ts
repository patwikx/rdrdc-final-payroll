import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { minioClient, DOCUMENTS_BUCKET, generateFileName } from '@/lib/minio';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const businessUnitId = formData.get('businessUnitId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!businessUnitId) {
      return NextResponse.json(
        { success: false, error: 'Business unit ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Verify business unit exists
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId }
    });

    if (!businessUnit) {
      return NextResponse.json(
        { success: false, error: 'Business unit not found' },
        { status: 404 }
      );
    }

    // Generate unique filename with business unit prefix
    const fileName = `business-unit-logos/${businessUnitId}/${generateFileName(file.name)}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to MinIO
    await minioClient.putObject(DOCUMENTS_BUCKET, fileName, buffer, file.size, {
      'Content-Type': file.type,
      'Content-Disposition': `inline; filename="${file.name}"`,
      'original-filename': file.name,
      'business-unit-id': businessUnitId,
      'file-type': 'business-unit-logo',
    });

    // Remove old logo if exists
    if (businessUnit.image) {
      try {
        await minioClient.removeObject(DOCUMENTS_BUCKET, businessUnit.image);
      } catch (error) {
        console.warn('Failed to remove old logo:', error);
      }
    }

    // Update business unit with new logo filename
    await prisma.businessUnit.update({
      where: { id: businessUnitId },
      data: { image: fileName }
    });

    // Generate presigned URL for immediate display
    const fileUrl = await minioClient.presignedGetObject(DOCUMENTS_BUCKET, fileName, 60 * 60); // 1 hour

    return NextResponse.json({
      success: true,
      fileName,
      fileUrl,
      message: 'Business unit logo uploaded successfully'
    });

  } catch (error) {
    console.error('Business unit logo upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    const businessUnitId = searchParams.get('businessUnitId');

    if (!fileName || !businessUnitId) {
      return NextResponse.json(
        { success: false, error: 'File name and business unit ID are required' },
        { status: 400 }
      );
    }

    // Verify business unit exists and user has permission
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId }
    });

    if (!businessUnit) {
      return NextResponse.json(
        { success: false, error: 'Business unit not found' },
        { status: 404 }
      );
    }

    // Remove from MinIO
    try {
      await minioClient.removeObject(DOCUMENTS_BUCKET, fileName);
    } catch (error) {
      console.warn('Failed to remove file from MinIO:', error);
    }

    // Update business unit to remove logo reference
    await prisma.businessUnit.update({
      where: { id: businessUnitId },
      data: { image: null }
    });

    return NextResponse.json({
      success: true,
      message: 'Business unit logo removed successfully'
    });

  } catch (error) {
    console.error('Business unit logo delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}