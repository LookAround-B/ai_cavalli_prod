import { PrismaClient } from '@prisma/client'

/**
 * Generates the next serial bill number in format A001, A002 ... A999, B001 ...
 * Finds the highest existing serial bill number and increments it.
 */
export async function nextSerialBillNumber(prisma: PrismaClient): Promise<string> {
    const result = await prisma.$queryRaw<{ bill_number: string }[]>`
        SELECT bill_number
        FROM bills
        WHERE bill_number ~ '^[A-Z][0-9]{3}$'
        ORDER BY
            ASCII(SUBSTRING(bill_number, 1, 1)) DESC,
            CAST(SUBSTRING(bill_number, 2) AS INTEGER) DESC
        LIMIT 1
    `

    let nextN = 1
    if (result && result.length > 0) {
        const last = result[0].bill_number
        const letterIdx = last.charCodeAt(0) - 65
        const num = parseInt(last.slice(1), 10)
        nextN = letterIdx * 999 + num + 1
    }

    const letterIdx = Math.floor((nextN - 1) / 999)
    const numericPart = ((nextN - 1) % 999) + 1
    return `${String.fromCharCode(65 + letterIdx)}${String(numericPart).padStart(3, '0')}`
}
