-- CreateTable: ListFavorite for tracking user's favorite lists and folders
CREATE TABLE "list_favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_favorite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "list_favorite_check" CHECK (("listId" IS NOT NULL AND "folderId" IS NULL) OR ("listId" IS NULL AND "folderId" IS NOT NULL))
);

-- CreateTable: ListOpen for tracking when users open lists/folders
CREATE TABLE "list_open" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT,
    "folderId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_open_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "list_open_check" CHECK (("listId" IS NOT NULL AND "folderId" IS NULL) OR ("listId" IS NULL AND "folderId" IS NOT NULL))
);

-- CreateIndex
CREATE INDEX "list_favorite_userId_idx" ON "list_favorite"("userId");
CREATE UNIQUE INDEX "list_favorite_userId_listId_key" ON "list_favorite"("userId", "listId") WHERE "listId" IS NOT NULL;
CREATE UNIQUE INDEX "list_favorite_userId_folderId_key" ON "list_favorite"("userId", "folderId") WHERE "folderId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "list_open_userId_openedAt_idx" ON "list_open"("userId", "openedAt" DESC);

-- AddForeignKey
ALTER TABLE "list_favorite" ADD CONSTRAINT "list_favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "list_favorite" ADD CONSTRAINT "list_favorite_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lead_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "list_favorite" ADD CONSTRAINT "list_favorite_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "lead_list_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_open" ADD CONSTRAINT "list_open_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "list_open" ADD CONSTRAINT "list_open_listId_fkey" FOREIGN KEY ("listId") REFERENCES "lead_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "list_open" ADD CONSTRAINT "list_open_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "lead_list_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
