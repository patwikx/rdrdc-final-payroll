import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const main = async () => {
  const pendingRows = await prisma.payslip.count({
    where: {
      OR: [{ departmentSnapshotId: null }, { departmentSnapshotName: null }],
    },
  })

  if (pendingRows === 0) {
    console.log("No payslips require department snapshot backfill.")
    return
  }

  const updatedCountResult = await prisma.$executeRaw`
    WITH source AS (
      SELECT
        p."id" AS payslip_id,
        e."departmentId" AS department_id,
        d."name" AS department_name
      FROM "Payslip" p
      JOIN "Employee" e ON e."id" = p."employeeId"
      LEFT JOIN "Department" d ON d."id" = e."departmentId"
      WHERE p."departmentSnapshotId" IS NULL
         OR p."departmentSnapshotName" IS NULL
    )
    UPDATE "Payslip" p
    SET
      "departmentSnapshotId" = s.department_id,
      "departmentSnapshotName" = s.department_name
    FROM source s
    WHERE p."id" = s.payslip_id
  `

  const remainingRows = await prisma.payslip.count({
    where: {
      OR: [{ departmentSnapshotId: null }, { departmentSnapshotName: null }],
    },
  })

  console.log(`Payslip snapshot rows pending before: ${pendingRows}`)
  console.log(`Payslip rows updated: ${updatedCountResult}`)
  console.log(`Payslip snapshot rows still pending: ${remainingRows}`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
