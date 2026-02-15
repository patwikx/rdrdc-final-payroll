import { Prisma, PrismaClient } from "@prisma/client"

const EXCLUDED_EMPLOYEE_NUMBERS = ["admin", "T-123"] as const

const employeeNumberExclusionWhere: Prisma.EmployeeWhereInput = {
  employeeNumber: { notIn: [...EXCLUDED_EMPLOYEE_NUMBERS] },
}

function withExcludedEmployeeNumbers<T extends { where?: Prisma.EmployeeWhereInput }>(args: T): T {
  if (!args.where) {
    return { ...args, where: employeeNumberExclusionWhere }
  }

  return {
    ...args,
    where: {
      AND: [args.where, employeeNumberExclusionWhere],
    },
  }
}

const createPrismaClient = (): PrismaClient =>
  (new PrismaClient().$extends({
    query: {
      employee: {
        findFirst({ args, query }) {
          return query(withExcludedEmployeeNumbers(args))
        },
        findMany({ args, query }) {
          return query(withExcludedEmployeeNumbers(args))
        },
        count({ args, query }) {
          return query(withExcludedEmployeeNumbers(args))
        },
        aggregate({ args, query }) {
          return query(withExcludedEmployeeNumbers(args))
        },
        groupBy({ args, query }) {
          return query(withExcludedEmployeeNumbers(args))
        },
      },
    },
  }) as unknown as PrismaClient)

declare global {
  var prisma: PrismaClient | undefined
}

export const db = global.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  global.prisma = db
}
