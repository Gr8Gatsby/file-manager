import { z } from "zod";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  schema?: z.ZodType;
  mappingValidation?: {
    isValid: boolean;
    errors: string[];
  };
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

  static validateMapping(mapping: any[], jsonData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    mapping.forEach((map, index) => {
      if (!map.jsonPath || !map.targetSelector || !map.updateType) {
        errors.push(`Mapping ${index + 1}: Missing required fields`);
        return;
      }

      // Validate JSON path exists
      const pathParts = map.jsonPath.split('.');
      let current = jsonData;
      for (const part of pathParts) {
        if (part.includes('[*]')) {
          const arrayPath = part.replace('[*]', '');
          if (!Array.isArray(current?.[arrayPath])) {
            errors.push(`Mapping ${index + 1}: Invalid array path '${map.jsonPath}'`);
            break;
          }
          current = current[arrayPath];
        } else {
          if (current?.[part] === undefined) {
            errors.push(`Mapping ${index + 1}: Path '${map.jsonPath}' not found in JSON data`);
            break;
          }
          current = current[part];
        }
      }

      // Validate update type and attribute name
      if (map.updateType === 'attribute' && !map.attributeName) {
        errors.push(`Mapping ${index + 1}: Attribute name is required for attribute updates`);
      }

      // Validate selector syntax
      try {
        document.createElement('div').querySelector(map.targetSelector);
      } catch (error) {
        errors.push(`Mapping ${index + 1}: Invalid CSS selector '${map.targetSelector}'`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateJsonWithHTML(jsonData: any, html: string, mapping?: any[]): ValidationResult {
    const schema = this.extractSchemaFromHTML(html);
    const schemaValidation = schema ? this.validateJsonAgainstSchema(jsonData, schema) : { isValid: true, errors: [] };
    
    let mappingValidation = { isValid: true, errors: [] };
    if (mapping && mapping.length > 0) {
      mappingValidation = this.validateMapping(mapping, jsonData);
    }

    return {
      ...schemaValidation,
      mappingValidation,
      isValid: schemaValidation.isValid && mappingValidation.isValid
    };
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