import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true
          }
        },
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            employeeId: true
          }
        },
        deployments: {
          where: {
            status: {
              in: ['DEPLOYED', 'APPROVED']
            },
            returnedDate: null
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeId: true
              }
            }
          },
          orderBy: {
            deployedDate: 'desc'
          },
          take: 1
        },
        assetHistories: {
          include: {
            employee: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            performedAt: 'desc'
          },
          take: 20
        }
      }
    })

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }

    // Convert Decimal fields to numbers for JSON serialization
    const assetData = {
      ...asset,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
      currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation),
      monthlyDepreciation: asset.monthlyDepreciation ? Number(asset.monthlyDepreciation) : null,
      depreciationRate: asset.depreciationRate ? Number(asset.depreciationRate) : null,
      depreciationPerUnit: asset.depreciationPerUnit ? Number(asset.depreciationPerUnit) : null,
      currentDeployment: asset.deployments?.[0] || null,
      recentHistory: asset.assetHistories || []
    }

    return NextResponse.json(assetData)
  } catch (error) {
    console.error("Error fetching public asset details:", error)
    return NextResponse.json(
      { error: "Failed to fetch asset details" },
      { status: 500 }
    )
  }
}