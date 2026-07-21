-- 기존 행의 variant를 name에 합치고 (예: "떡" + "치즈떡" -> "떡(치즈떡)"),
-- category/isBase는 코드 어디에서도 읽지 않는 순수 표시용 필드였으므로 함께 제거한다.
UPDATE "Ingredient"
SET "name" = "name" || '(' || "variant" || ')'
WHERE "variant" IS NOT NULL AND "variant" != '';

ALTER TABLE "Ingredient" DROP COLUMN "category";
ALTER TABLE "Ingredient" DROP COLUMN "variant";
ALTER TABLE "Ingredient" DROP COLUMN "isBase";
