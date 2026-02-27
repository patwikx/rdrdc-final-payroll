import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { minioClient, DOCUMENTS_BUCKET } from '@/lib/minio';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileName } = await params;

    if (!fileName) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    const decodedFileName = decodeURIComponent(fileName);

    // Verify the file belongs to the user OR user is ADMIN/HR/MANAGER (security check)
    const isOwnFile = decodedFileName.startsWith(`profile-pictures/${session.user.id}/`);
    const canAccessOtherFiles = session.user.role === 'ADMIN' || session.user.role === 'HR' || session.user.role === 'MANAGER';
    
    if (!isOwnFile && !canAccessOtherFiles) {
      return NextResponse.json({ error: 'Unauthorized to access this file' }, { status: 403 });
    }

    // Check if direct image streaming is requested
    const { searchParams } = new URL(request.url);
    const direct = searchParams.get('direct') === 'true';

    if (direct) {
      // Stream the image directly
      const stream = await minioClient.getObject(DOCUMENTS_BUCKET, decodedFileName);
      
      // Determine content type based on file extension
      const extension = decodedFileName.split('.').pop()?.toLowerCase();
      const contentType = extension === 'png' ? 'image/png' 
        : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
        : extension === 'gif' ? 'image/gif'
        : extension === 'webp' ? 'image/webp'
        : 'application/octet-stream';

      return new NextResponse(stream as unknown as ReadableStream, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Generate a presigned URL for the file (valid for 1 hour)
    const presignedUrl = await minioClient.presignedGetObject(
      DOCUMENTS_BUCKET,
      decodedFileName,
      60 * 60 // 1 hour
    );

    return NextResponse.json({
      success: true,
      fileUrl: presignedUrl,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate URL' },
      { status: 500 }
    );
  }
}