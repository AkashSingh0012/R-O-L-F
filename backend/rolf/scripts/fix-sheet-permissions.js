const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    const sheets = await prisma.sheet.findMany({
        where: {
            SheetPermission: {
                none: {
                    role: "OWNER",
                },
            },
        },
    });

    console.log(`Found ${sheets.length} sheets missing OWNER permission`);

    for (const sheet of sheets) {
        await prisma.sheetPermission.create({
            data: {
                sheetId: sheet.id,
                userId: sheet.createdBy,
                role: "OWNER",
            },
        });
        console.log(`Fixed sheet: ${sheet.id} - ${sheet.name}`);
    }

    console.log("Done!");
}

main()
    .catch((err) => {
        console.error("Script failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });