import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { minioClient, DOCUMENTS_BUCKET } from '@/lib/minio';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { fileName } = await params;
    const decodedFileName = decodeURIComponent(fileName);

    if (!decodedFileName) {
      return NextResponse.json(
        { success: false, error: 'File name is required' },
        { status: 400 }
      );
    }

    try {
      // Check if file exists
      await minioClient.statObject(DOCUMENTS_BUCKET, decodedFileName);
      
      // Generate presigned URL (valid for 1 hour)
      const fileUrl = await minioClient.presignedGetObject(DOCUMENTS_BUCKET, decodedFileName, 60 * 60);
      
      return NextResponse.json({
        success: true,
        fileUrl,
        fileName: decodedFileName
      });
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return NextResponse.json(
          { success: false, error: 'File not found' },
          { status: 404 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Business unit logo fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}