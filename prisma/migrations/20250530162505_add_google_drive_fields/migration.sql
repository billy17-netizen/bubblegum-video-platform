-- DropIndex
DROP INDEX "Video_title_adminId_key";

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "googleDriveFileId" TEXT,
ADD COLUMN     "googleDriveThumbnailId" TEXT,
ADD COLUMN     "googleDriveThumbnailUrl" TEXT,
ADD COLUMN     "googleDriveVideoUrl" TEXT;
