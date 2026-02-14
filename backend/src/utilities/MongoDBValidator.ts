/**
 * MongoDB Query Validator
 * Validates aggregation pipelines and collection names to prevent errors and security issues
 */
export class MongoDBValidator {
    /**
     * Validate MongoDB aggregation pipeline structure
     * 
     * @param pipeline - The aggregation pipeline array to validate
     * @returns Validation result with valid flag and optional error message
     */
    static validatePipeline(pipeline: any): { valid: boolean; error?: string } {
        if (!Array.isArray(pipeline)) {
            return { valid: false, error: 'Pipeline must be an array' };
        }
        
        if (pipeline.length === 0) {
            return { valid: false, error: 'Pipeline cannot be empty' };
        }
        
        // Validate each stage
        for (let i = 0; i < pipeline.length; i++) {
            const stage = pipeline[i];
            
            if (typeof stage !== 'object' || stage === null) {
                return { valid: false, error: `Stage ${i} must be an object` };
            }
            
            const keys = Object.keys(stage);
            if (keys.length !== 1) {
                return { valid: false, error: `Stage ${i} must have exactly one operator` };
            }
            
            const operator = keys[0];
            if (!operator.startsWith('$')) {
                return { valid: false, error: `Stage ${i} operator '${operator}' must start with $` };
            }
            
            // Validate known operators (MongoDB 7.0 aggregation operators)
            const validOperators = [
                // Stage operators
                '$match', '$project', '$group', '$sort', '$limit', '$skip',
                '$unwind', '$lookup', '$addFields', '$count', '$facet',
                '$bucket', '$bucketAuto', '$sortByCount', '$replaceRoot',
                '$sample', '$out', '$merge', '$graphLookup', '$redact',
                '$geoNear', '$indexStats', '$planCacheStats', '$collStats',
                '$changeStream', '$changeStreamSplitLargeEvent', '$densify',
                '$documents', '$fill', '$listSessions', '$replaceWith',
                '$search', '$searchMeta', '$set', '$setWindowFields',
                '$shardedDataDistribution', '$unionWith', '$unset'
            ];
            
            if (!validOperators.includes(operator)) {
                return { 
                    valid: false, 
                    error: `Unknown or potentially unsafe operator: ${operator}. If this is a valid MongoDB 7.0 operator, please contact support.` 
                };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Validate collection name to prevent injection and ensure MongoDB naming rules
     * 
     * @param name - The collection name to validate
     * @returns Validation result with valid flag and optional error message
     */
    static validateCollectionName(name: string): { valid: boolean; error?: string } {
        if (typeof name !== 'string' || name.trim().length === 0) {
            return { valid: false, error: 'Collection name must be a non-empty string' };
        }
        
        // Trim the name
        const trimmedName = name.trim();
        
        // MongoDB collection name restrictions
        // https://www.mongodb.com/docs/manual/reference/limits/#naming-restrictions
        
        // Cannot contain null character
        if (trimmedName.includes('\0')) {
            return { valid: false, error: 'Collection name cannot contain null character' };
        }
        
        // Cannot contain $ (except in system collections)
        if (trimmedName.includes('$')) {
            return { valid: false, error: 'Collection name cannot contain $ character' };
        }
        
        // Cannot start with "system." (reserved for system collections)
        if (trimmedName.startsWith('system.')) {
            return { valid: false, error: 'Cannot query system collections directly' };
        }
        
        // Cannot be empty string
        if (trimmedName === '') {
            return { valid: false, error: 'Collection name cannot be empty' };
        }
        
        // Maximum length check (MongoDB allows up to 255 bytes for namespace)
        // Collection name + database name + 1 (for dot) should be < 255
        // Being conservative, limit collection name to 200 characters
        if (trimmedName.length > 200) {
            return { valid: false, error: 'Collection name too long (maximum 200 characters)' };
        }
        
        return { valid: true };
    }
    
    /**
     * Validate complete MongoDB query JSON structure
     * 
     * @param queryJSON - The query JSON string
     * @returns Validation result with parsed query or error
     */
    static validateQueryJSON(queryJSON: string): { 
        valid: boolean; 
        collection?: string; 
        pipeline?: any[]; 
        error?: string 
    } {
        let parsed: any;
        
        // Parse JSON
        try {
            parsed = JSON.parse(queryJSON);
        } catch (e) {
            return { valid: false, error: 'Invalid JSON format' };
        }
        
        // Check structure
        if (typeof parsed !== 'object' || parsed === null) {
            return { valid: false, error: 'Query JSON must be an object' };
        }
        
        // Extract collection and pipeline
        const collection = parsed.collection;
        const pipeline = parsed.pipeline;
        
        if (!collection) {
            return { valid: false, error: 'Missing collection name in query' };
        }
        
        if (!pipeline) {
            return { valid: false, error: 'Missing pipeline in query' };
        }
        
        // Validate collection name
        const collectionValidation = this.validateCollectionName(collection);
        if (!collectionValidation.valid) {
            return { valid: false, error: collectionValidation.error };
        }
        
        // Validate pipeline
        const pipelineValidation = this.validatePipeline(pipeline);
        if (!pipelineValidation.valid) {
            return { valid: false, error: pipelineValidation.error };
        }
        
        return { 
            valid: true, 
            collection, 
            pipeline 
        };
    }
}
