import axios, { AxiosInstance } from 'axios';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const AIRTABLE_META_API_BASE = 'https://api.airtable.com/v0/meta';

/**
 * Get Airtable Base ID from environment variables
 */
function getAirtableBaseId(): string {
  if (!AIRTABLE_BASE_ID) {
    throw new Error('AIRTABLE_BASE_ID not found in environment variables');
  }
  return AIRTABLE_BASE_ID;
}

/**
 * Get Airtable API client with authorization header
 */
function getAirtableClient(): AxiosInstance {
  const token = process.env.AIRTABLE_TOKEN;
  
  if (!token) {
    throw new Error('AIRTABLE_TOKEN not found in environment variables');
  }

  return axios.create({
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Get all tables metadata for a base
 */
export async function getTables() {
  try {
    const client = getAirtableClient();
    const baseId = getAirtableBaseId();
    const response = await client.get(`${AIRTABLE_META_API_BASE}/bases/${baseId}/tables`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching Airtable tables:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create a new table in Airtable
 */
export async function createTable(tableName: string, fields: any[]) {
  try {
    const client = getAirtableClient();
    const payload = {
      name: tableName,
      description: `Table for ${tableName} content`,
      fields: fields
    };
    console.log('Creating table with payload:', JSON.stringify(payload, null, 2));
    const baseId = getAirtableBaseId();
    const response = await client.post(`${AIRTABLE_META_API_BASE}/bases/${baseId}/tables`, payload);
    return response.data;
  } catch (error: any) {
    console.error('Error creating Airtable table:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Airtable error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Get records from a table (using data API)
 */
export async function getRecords(tableNameOrId: string, options: {
  view?: string;
  maxRecords?: number;
  filterByFormula?: string;
} = {}) {
  try {
    const client = getAirtableClient();
    const params = new URLSearchParams();
    
    if (options.view) params.append('view', options.view);
    if (options.maxRecords) params.append('maxRecords', options.maxRecords.toString());
    if (options.filterByFormula) params.append('filterByFormula', options.filterByFormula);
    
    const queryString = params.toString();
    const baseId = getAirtableBaseId();
    const url = `${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableNameOrId)}${queryString ? `?${queryString}` : ''}`;
    
    const response = await client.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching Airtable records:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create a record in a table (using data API)
 */
export async function createRecord(tableNameOrId: string, fields: Record<string, any>) {
  try {
    const client = getAirtableClient();
    const baseId = getAirtableBaseId();
    const response = await client.post(`${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableNameOrId)}`, {
      fields: fields
    });
    return response.data;
  } catch (error: any) {
    console.error('Error creating Airtable record:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update a record in a table (using data API)
 */
export async function updateRecord(tableNameOrId: string, recordId: string, fields: Record<string, any>) {
  try {
    const client = getAirtableClient();
    const baseId = getAirtableBaseId();
    const response = await client.patch(`${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableNameOrId)}/${recordId}`, {
      fields: fields
    });
    return response.data;
  } catch (error: any) {
    console.error('Error updating Airtable record:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Find or create content table
 * Creates a table with fields for hero and header sections if it doesn't exist
 */
export async function findOrCreateContentTable() {
  try {
    // First, get all tables to check if content table exists
    const tablesData = await getTables();
    const contentTable = tablesData.tables?.find((table: any) => 
      table.name.toLowerCase() === 'content'
    );

    if (contentTable) {
      return contentTable;
    }

    // Create content table with appropriate fields
    // First field must be a text field (primary field)
    const fields = [
      {
        name: 'Name',
        type: 'singleLineText',
        description: 'Primary field for content table'
      },
      {
        name: 'Section',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'header' },
            { name: 'hero' }
          ]
        }
      },
      {
        name: 'JSON Data',
        type: 'multilineText',
        description: 'Stores JSON data for the section (header or hero)'
      }
    ];

    const newTable = await createTable('Content', fields);
    return newTable;
  } catch (error) {
    console.error('Error finding or creating content table:', error);
    throw error;
  }
}

/**
 * Update or create content in Airtable
 * Accepts both header and hero data
 * 
 * @param contentData - Content to update
 * @param contentData.header - Header content with logoUrl and logoAlt
 * @param contentData.hero - Hero content with title and subtitle (no highlights)
 */
export async function updateContent(contentData: { header?: any; hero?: { title: string; subtitle: string } }) {
  try {
    // Get or create content table
    const contentTable = await findOrCreateContentTable();
    const tableName = contentTable.name || 'Content';
    
    const results: any = {};

    // Update header if provided
    if (contentData.header) {
      const headerRecords = await getRecords(tableName, {
        filterByFormula: `{Section} = "header"`
      });

      const headerJsonData = JSON.stringify(contentData.header);

      if (headerRecords.records && headerRecords.records.length > 0) {
        const recordId = headerRecords.records[0].id;
        results.header = await updateRecord(tableName, recordId, {
          'Section': 'header',
          'JSON Data': headerJsonData
        });
      } else {
        results.header = await createRecord(tableName, {
          'Name': 'header',
          'Section': 'header',
          'JSON Data': headerJsonData
        });
      }
    }

    // Update hero if provided
    if (contentData.hero) {
      const heroRecords = await getRecords(tableName, {
        filterByFormula: `{Section} = "hero"`
      });

      const heroJsonData = JSON.stringify(contentData.hero);

      if (heroRecords.records && heroRecords.records.length > 0) {
        const recordId = heroRecords.records[0].id;
        results.hero = await updateRecord(tableName, recordId, {
          'Section': 'hero',
          'JSON Data': heroJsonData
        });
      } else {
        results.hero = await createRecord(tableName, {
          'Name': 'hero',
          'Section': 'hero',
          'JSON Data': heroJsonData
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error updating content:', error);
    throw error;
  }
}

/**
 * Get all content from Airtable (header and hero)
 * Returns content with the new structure:
 * - hero: { title: string, subtitle: string } (no highlights)
 * - header: { logoUrl: string, logoAlt: string }
 */
export async function getContent() {
  try {
    const contentTable = await findOrCreateContentTable();
    const tableName = contentTable.name || 'Content';
    
    const records = await getRecords(tableName);
    
    const content: { header: any; hero: any } = {
      header: null,
      hero: null
    };

    if (records.records && records.records.length > 0) {
      records.records.forEach((record: any) => {
        const section = record.fields['Section'];
        const jsonData = record.fields['JSON Data'];
        
        if (section === 'header' || section === 'hero') {
          try {
            const parsedData = JSON.parse(jsonData);
            
            // Clean up hero data: remove old highlights field if it exists
            if (section === 'hero' && parsedData) {
              content.hero = {
                title: parsedData.title || '',
                subtitle: parsedData.subtitle || ''
              };
            } else if (section === 'header') {
              content.header = parsedData;
            }
          } catch (parseError) {
            console.error(`Error parsing JSON for ${section}:`, parseError);
          }
        }
      });
    }

    return content;
  } catch (error) {
    console.error('Error getting content:', error);
    throw error;
  }
}

/**
 * Find or create phone numbers table
 * Creates a table with phone number field if it doesn't exist
 */
export async function findOrCreatePhoneTable() {
  try {
    const tablesData = await getTables();
    const phoneTable = tablesData.tables?.find((table: any) => 
      table.name.toLowerCase() === 'phone numbers' || table.name.toLowerCase() === 'phonenumbers'
    );

    if (phoneTable) {
      return phoneTable;
    }

    // Create phone numbers table
    const fields = [
      {
        name: 'Phone Number',
        type: 'phoneNumber',
        description: 'Phone number from SMS'
      },
      {
        name: 'Message',
        type: 'singleLineText',
        description: 'Message content from SMS'
      },
      {
        name: 'Last Updated',
        type: 'dateTime',
        description: 'Last time this phone number was updated',
        options: {
          dateFormat: {
            name: 'iso'
          },
          timeFormat: {
            name: '24hour'
          },
          timeZone: 'utc'
        }
      }
    ];

    const newTable = await createTable('Phone Numbers', fields);
    return newTable;
  } catch (error) {
    console.error('Error finding or creating phone table:', error);
    throw error;
  }
}

/**
 * Find a record by phone number
 */
export async function findByPhone(phoneNumber: string) {
  try {
    if (!phoneNumber) {
      return null;
    }
    
    const phoneTable = await findOrCreatePhoneTable();
    const tableName = phoneTable.name || 'Phone Numbers';
    
    // Escape quotes in phone number for Airtable formula
    const escapedPhone = phoneNumber.replace(/"/g, '\\"');
    
    const records = await getRecords(tableName, {
      filterByFormula: `{Phone Number} = "${escapedPhone}"`
    });

    if (records.records && records.records.length > 0) {
      return records.records[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error finding phone number:', error);
    throw error;
  }
}

/**
 * Create a new phone number record
 */
export async function createPhoneRecord(phoneNumber: string, message: string) {
  try {
    const phoneTable = await findOrCreatePhoneTable();
    const tableName = phoneTable.name || 'Phone Numbers';
    
    const record = await createRecord(tableName, {
      'Phone Number': phoneNumber,
      'Message': message || '',
      'Last Updated': new Date().toISOString()
    });
    
    return record;
  } catch (error) {
    console.error('Error creating phone record:', error);
    throw error;
  }
}

/**
 * Update an existing phone number record
 */
export async function updatePhoneRecord(recordId: string, phoneNumber: string, message: string) {
  try {
    const phoneTable = await findOrCreatePhoneTable();
    const tableName = phoneTable.name || 'Phone Numbers';
    
    const record = await updateRecord(tableName, recordId, {
      'Phone Number': phoneNumber,
      'Message': message || '',
      'Last Updated': new Date().toISOString()
    });
    
    return record;
  } catch (error) {
    console.error('Error updating phone record:', error);
    throw error;
  }
}

