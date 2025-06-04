/*
  Warnings:

  - A unique constraint covering the columns `[title,adminId]` on the table `Video` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Video_title_adminId_key" ON "Video"("title", "adminId");
