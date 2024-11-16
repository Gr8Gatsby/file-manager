import { z } from "zod";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  schema?: z.ZodType;
}

export class SchemaValidator {
  private static extractSchemaFromHTML(html: string): z.ZodType | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const schemaScript = doc.querySelector('script[type="application/schema"]');
      
      if (!schemaScript) return null;
      
      const schemaDefinition = schemaScript.textContent;
      if (!schemaDefinition) return null;

      // Parse the schema definition
      const schema = eval(`(${schemaDefinition})`);
      return z.object(schema);
    } catch (error) {
      console.error('Error extracting schema:', error);
      return null;
    }
  }

  static validateJsonAgainstSchema(jsonData: any, schema: z.ZodType): ValidationResult {
    try {
      schema.parse(jsonData);
      return { isValid: true, errors: [], schema };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          schema
        };
      }
      return { isValid: false, errors: ['Invalid schema format'], schema };
    }
  }

  static validateJsonWithHTML(jsonData: any, html: string): ValidationResult {
    const schema = this.extractSchemaFromHTML(html);
    if (!schema) {
      return { isValid: true, errors: [] }; // No schema defined, consider valid
    }
    return this.validateJsonAgainstSchema(jsonData, schema);
  }

  static generateSchemaFromJson(json: any): z.ZodType {
    const generateSchema = (value: any): z.ZodType => {
      if (value === null) return z.null();
      if (Array.isArray(value)) {
        if (value.length === 0) return z.array(z.unknown());
        const itemSchema = generateSchema(value[0]);
        return z.array(itemSchema);
      }
      
      switch (typeof value) {
        case 'string':
          return z.string();
        case 'number':
          return Number.isInteger(value) ? z.number().int() : z.number();
        case 'boolean':
          return z.boolean();
        case 'object': {
          const shape: Record<string, z.ZodType> = {};
          for (const [key, val] of Object.entries(value)) {
            shape[key] = generateSchema(val);
          }
          return z.object(shape);
        }
        default:
          return z.unknown();
      }
    };

    return generateSchema(json);
  }

  static generateSchemaDefinition(schema: z.ZodType): string {
    return schema.toString();
  }
}
