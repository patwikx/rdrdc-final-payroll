import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { minioClient, DOCUMENTS_BUCKET, generateFileName } from '@/lib/minio';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (5MB limit for profile pictures)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    // Validate file type (only images)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    // Generate unique filename with profile prefix
    const fileName = `profile-pictures/${session.user.id}/${generateFileName(file.name)}`;
    
    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    // Upload to MinIO (private bucket)
    await minioClient.putObject(
      DOCUMENTS_BUCKET,
      fileName,
      fileBuffer,
      file.size,
      {
        'Content-Type': file.type,
        'Content-Disposition': `inline; filename="${file.name}"`,
        'original-filename': file.name,
        'user-id': session.user.id,
        'file-type': 'profile-picture',
      }
    );

    // Update user's profile picture in database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        profilePicture: fileName 
      },
    });

    // Generate a presigned URL for immediate access (valid for 1 hour)
    const presignedUrl = await minioClient.presignedGetObject(
      DOCUMENTS_BUCKET,
      fileName,
      60 * 60 // 1 hour
    );

    return NextResponse.json({
      success: true,
      fileName,
      fileUrl: presignedUrl,
      originalName: file.name,
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    // Verify the file belongs to the user
    if (!fileName.startsWith(`profile-pictures/${session.user.id}/`)) {
      return NextResponse.json({ error: 'Unauthorized to delete this file' }, { status: 403 });
    }

    // Delete from MinIO
    await minioClient.removeObject(DOCUMENTS_BUCKET, fileName);

    // Update user's profile picture in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        profilePicture: null 
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}