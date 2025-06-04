-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "bunnyStreamUrl" TEXT,
ADD COLUMN     "bunnyThumbnailUrl" TEXT,
ADD COLUMN     "bunnyVideoId" TEXT,
ADD COLUMN     "fileHash" TEXT,
ADD COLUMN     "fileSize" BIGINT,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "storageType" TEXT;
