-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "email_status" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'mock';
