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

const propRegex = /@Prop\(\{[^}]*type:\s*([A-Za-z\[\].]+)[^}]*\}\)\s*\n\s*(\w+):\s*[\w\[\]]+;/g;

const fields = [];
let match;

while ((match = propRegex.exec(schemaContent)) !== null) {
  let [, type, name] = match;
  type = type.toLowerCase();

  let tsType = "string";
  if (["number"].includes(type)) tsType = "number";
  if (["boolean"].includes(type)) tsType = "boolean";
  if (["date"].includes(type)) tsType = "Date";
  if (type.includes("string[]") || type.includes("[string]")) tsType = "string[]";

  fields.push({ name, type: tsType });
}

function genApiProperty(name, type) {
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

  return `  @ApiProperty({ type: ${swaggerType} })\n  ${name}: ${type};\n`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const createDto = `import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class Create${capitalize(moduleName)}Dto {
${fields.map(f => genApiProperty(f.name, f.type)).join("\n")}
}
`;

const updateDto = `import { PartialType } from '@nestjs/swagger';
import { Create${capitalize(moduleName)}Dto } from './create-${moduleName}.dto';

export class Update${capitalize(moduleName)}Dto extends PartialType(Create${capitalize(moduleName)}Dto) {}
`;

const responseDto = `import { ApiProperty } from '@nestjs/swagger';

export class ${capitalize(moduleName)}ResponseDto {
${fields.map(f => genApiProperty(f.name, f.type)).join("\n")}
}
`;

const filterDto = `import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';

export class Filter${capitalize(moduleName)}Dto {
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
