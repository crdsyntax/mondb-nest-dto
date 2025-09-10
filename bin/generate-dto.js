#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const moduleName = process.argv[2];

if (!moduleName) {
  console.error("❌ Debes pasar el nombre del módulo. Ej: node generate-dtos.js project");
  process.exit(1);
}

const schemaPath = path.resolve(`./src/${moduleName}/schemas/${moduleName}.schema.ts`);
const dtoDir = path.resolve(`./src/${moduleName}/dto`);

if (!fs.existsSync(schemaPath)) {
  console.error(`❌ No se encontró el schema en: ${schemaPath}`);
  process.exit(1);
}

if (!fs.existsSync(dtoDir)) {
  fs.mkdirSync(dtoDir, { recursive: true });
}

const schemaContent = fs.readFileSync(schemaPath, "utf8");

const propRegex = /@Prop\([^)]*\)\s*\n\s*(\w+):\s*([^;]+);/g;

const fields = [];
let match;

while ((match = propRegex.exec(schemaContent)) !== null) {
  const [, name, rawType] = match;

  let tsType = "string";
  let validators = ["@IsString()"];

  if (/number/i.test(rawType)) {
    tsType = "number";
    validators = ["@IsNumber()"];
  } else if (/boolean/i.test(rawType)) {
    tsType = "boolean";
    validators = ["@IsBoolean()"];
  } else if (/date/i.test(rawType)) {
    tsType = "Date";
    validators = ["@IsDateString()"];
  } else if (/Types\.ObjectId\[\]/.test(rawType)) {
    tsType = "string[]";
    validators = ["@IsArray()", "@IsMongoId({ each: true })"];
  } else if (/Types\.ObjectId/.test(rawType)) {
    tsType = "string";
    validators = ["@IsMongoId()"];
  } else if (/string\[\]/i.test(rawType)) {
    tsType = "string[]";
    validators = ["@IsArray()", "@IsString({ each: true })"];
  }

  fields.push({ name, type: tsType, validators });
}

function genApiProperty(name, type, validators) {
  const swaggerType =
    type === "Date"
      ? "String"
      : type === "number"
      ? "Number"
      : type === "boolean"
      ? "Boolean"
      : type === "string[]"
      ? "[String]"
      : "String";

  return `  @ApiProperty({ type: ${swaggerType} })\n  ${validators.join("\n  ")}\n  ${name}: ${type};\n`;
}

function genApiPropertyOptional(name, type, validators) {
  const swaggerType =
    type === "Date"
      ? "String"
      : type === "number"
      ? "Number"
      : type === "boolean"
      ? "Boolean"
      : type === "string[]"
      ? "[String]"
      : "String";

  return `  @ApiPropertyOptional({ type: ${swaggerType} })\n  @IsOptional()\n  ${validators.join("\n  ")}\n  ${name}?: ${type};\n`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const importsValidators = `import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, IsDateString, IsMongoId } from 'class-validator';`;

const createDto = `import { ApiProperty } from '@nestjs/swagger';
${importsValidators}

export class Create${capitalize(moduleName)}Dto {
${fields.map(f => genApiProperty(f.name, f.type, f.validators)).join("\n")}
}
`;

const updateDto = `import { PartialType } from '@nestjs/swagger';
import { Create${capitalize(moduleName)}Dto } from './create-${moduleName}.dto';

export class Update${capitalize(moduleName)}Dto extends PartialType(Create${capitalize(moduleName)}Dto) {}
`;

const responseDto = `import { ApiProperty } from '@nestjs/swagger';

export class ${capitalize(moduleName)}ResponseDto {
${fields.map(f => {
  const swaggerType =
    f.type === "Date"
      ? "String"
      : f.type === "number"
      ? "Number"
      : f.type === "boolean"
      ? "Boolean"
      : f.type === "string[]"
      ? "[String]"
      : "String";
  return `  @ApiProperty({ type: ${swaggerType} })\n  ${f.name}: ${f.type};\n`;
}).join("\n")}
}
`;

const filterDto = `import { ApiPropertyOptional } from '@nestjs/swagger';
${importsValidators}

export class Filter${capitalize(moduleName)}Dto {
${fields.map(f => genApiPropertyOptional(f.name, f.type, f.validators)).join("\n")}

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
`;

fs.writeFileSync(path.join(dtoDir, `create-${moduleName}.dto.ts`), createDto);
fs.writeFileSync(path.join(dtoDir, `update-${moduleName}.dto.ts`), updateDto);
fs.writeFileSync(path.join(dtoDir, `response.dto.ts`), responseDto);
fs.writeFileSync(path.join(dtoDir, `filter-${moduleName}.dto.ts`), filterDto);

console.log("✅ DTOs generados en:", dtoDir);
