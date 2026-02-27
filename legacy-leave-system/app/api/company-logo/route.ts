import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { minioClient, DOCUMENTS_BUCKET } from '@/lib/minio';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Try to find the RD Realty Development Corporation business unit logo
    // First, let's get all business units and find one with a logo
    const { prisma } = await import('@/lib/prisma');
    
    const businessUnitWithLogo = await prisma.businessUnit.findFirst({
      where: {
        image: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        image: true
      }
    });

    if (!businessUnitWithLogo?.image) {
      return NextResponse.json(
        { success: false, error: 'No business unit logo found' },
        { status: 404 }
      );
    }

    const logoFileName = businessUnitWithLogo.image;
    
    try {
      // Check if file exists
      await minioClient.statObject(DOCUMENTS_BUCKET, logoFileName);
      
      // Generate presigned URL (valid for 1 hour)
      const fileUrl = await minioClient.presignedGetObject(DOCUMENTS_BUCKET, logoFileName, 60 * 60);
      
      return NextResponse.json({
        success: true,
        fileUrl,
        fileName: logoFileName
      });
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return NextResponse.json(
          { success: false, error: 'Logo not found' },
          { status: 404 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Company logo fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}