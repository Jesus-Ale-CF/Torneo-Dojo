-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TABLE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F', 'X');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'WEIGH_IN', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "BracketFormat" AS ENUM ('SINGLE_ELIMINATION', 'SINGLE_ELIMINATION_BRONZE', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('OPEN', 'BRACKET_READY', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "WeighInStatus" AS ENUM ('PENDING', 'OK', 'OVERWEIGHT', 'UNDERWEIGHT', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FINISHED', 'BYE');

-- CreateEnum
CREATE TYPE "BracketSide" AS ENUM ('WINNERS', 'LOSERS', 'GRAND_FINAL', 'THIRD_PLACE', 'ROUND_ROBIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TABLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultDurationSec" INTEGER NOT NULL DEFAULT 300,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VictoryMethod" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VictoryMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeltLevel" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "secondary" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BeltLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "city" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "sportId" TEXT NOT NULL,
    "pointsGold" INTEGER NOT NULL DEFAULT 9,
    "pointsSilver" INTEGER NOT NULL DEFAULT 3,
    "pointsBronze" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightDivision" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minKg" DOUBLE PRECISION,
    "maxKg" DOUBLE PRECISION,
    "gender" "Gender",
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeightDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgeGroup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "weightDivisionId" TEXT,
    "ageGroupId" TEXT,
    "beltLevelId" TEXT,
    "format" "BracketFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "status" "CategoryStatus" NOT NULL DEFAULT 'OPEN',
    "avoidSameAcademy" BOOLEAN NOT NULL DEFAULT true,
    "tiebreakRules" TEXT NOT NULL DEFAULT 'WINS,HEAD_TO_HEAD,METHOD_POINTS,DRAW',
    "matId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryBelt" (
    "categoryId" TEXT NOT NULL,
    "beltId" TEXT NOT NULL,

    CONSTRAINT "CategoryBelt_pkey" PRIMARY KEY ("categoryId","beltId")
);

-- CreateTable
CREATE TABLE "Academy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "city" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Academy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "beltLevelId" TEXT,
    "academyId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "categoryId" TEXT,
    "declaredWeight" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "weighInStatus" "WeighInStatus" NOT NULL DEFAULT 'PENDING',
    "weighedAt" TIMESTAMP(3),
    "seed" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mat" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,

    CONSTRAINT "Mat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatAssignment" (
    "userId" TEXT NOT NULL,
    "matId" TEXT NOT NULL,

    CONSTRAINT "MatAssignment_pkey" PRIMARY KEY ("userId","matId")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "side" "BracketSide" NOT NULL DEFAULT 'WINNERS',
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "redId" TEXT,
    "blueId" TEXT,
    "winnerId" TEXT,
    "victoryMethodId" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "nextMatchId" TEXT,
    "nextSlot" TEXT,
    "loserNextId" TEXT,
    "loserNextSlot" TEXT,
    "matId" TEXT,
    "matOrder" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "resultById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultAudit" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT,
    "previousWinnerId" TEXT,
    "previousMethodId" TEXT,
    "previousStatus" TEXT,
    "newWinnerId" TEXT,
    "newMethodId" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_name_key" ON "Sport"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VictoryMethod_sportId_code_key" ON "VictoryMethod"("sportId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BeltLevel_sportId_name_key" ON "BeltLevel"("sportId", "name");

-- CreateIndex
CREATE INDEX "Category_tournamentId_idx" ON "Category"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Academy_name_key" ON "Academy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_document_key" ON "Athlete"("document");

-- CreateIndex
CREATE INDEX "Registration_categoryId_idx" ON "Registration"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_tournamentId_athleteId_key" ON "Registration"("tournamentId", "athleteId");

-- CreateIndex
CREATE INDEX "Match_categoryId_idx" ON "Match"("categoryId");

-- CreateIndex
CREATE INDEX "Match_matId_status_idx" ON "Match"("matId", "status");

-- AddForeignKey
ALTER TABLE "VictoryMethod" ADD CONSTRAINT "VictoryMethod_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeltLevel" ADD CONSTRAINT "BeltLevel_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightDivision" ADD CONSTRAINT "WeightDivision_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeGroup" ADD CONSTRAINT "AgeGroup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_weightDivisionId_fkey" FOREIGN KEY ("weightDivisionId") REFERENCES "WeightDivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_ageGroupId_fkey" FOREIGN KEY ("ageGroupId") REFERENCES "AgeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_beltLevelId_fkey" FOREIGN KEY ("beltLevelId") REFERENCES "BeltLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_matId_fkey" FOREIGN KEY ("matId") REFERENCES "Mat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBelt" ADD CONSTRAINT "CategoryBelt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBelt" ADD CONSTRAINT "CategoryBelt_beltId_fkey" FOREIGN KEY ("beltId") REFERENCES "BeltLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_beltLevelId_fkey" FOREIGN KEY ("beltLevelId") REFERENCES "BeltLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mat" ADD CONSTRAINT "Mat_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatAssignment" ADD CONSTRAINT "MatAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatAssignment" ADD CONSTRAINT "MatAssignment_matId_fkey" FOREIGN KEY ("matId") REFERENCES "Mat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_redId_fkey" FOREIGN KEY ("redId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_blueId_fkey" FOREIGN KEY ("blueId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_victoryMethodId_fkey" FOREIGN KEY ("victoryMethodId") REFERENCES "VictoryMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_matId_fkey" FOREIGN KEY ("matId") REFERENCES "Mat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_resultById_fkey" FOREIGN KEY ("resultById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultAudit" ADD CONSTRAINT "ResultAudit_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultAudit" ADD CONSTRAINT "ResultAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
