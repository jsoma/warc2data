import { WARCParser } from 'warcio';
import JSZip from 'jszip';
import jq from 'jq-web';

// Configure jq-web to use the correct path for the WebAssembly file
// This helps ensure the .wasm file is found in the correct location
if (typeof jq.config === 'function') {
  jq.config({
    wasmUrl: '/static/js/jq.wasm'
  });
}

export async function processArchiveFiles(files) {
  const jsonFiles = [];
  const pages = [];
  const debugLogs = [];
  
  console.log(`Processing ${files.length} archive files`);
  
  for (const file of files) {
    try {
      if (file.name.endsWith('.warc') || file.name.endsWith('.warc.gz')) {
        console.log(`Processing WARC file: ${file.name}`);
        const { jsonResponses, allRequests } = await processWARC(file);
        console.log(`Found ${jsonResponses.length} JSON responses and ${allRequests.length} total requests in ${file.name}`);
        jsonFiles.push(...jsonResponses);
        debugLogs.push(...allRequests);
      } else if (file.name.endsWith('.wacz')) {
        console.log(`Processing WACZ file: ${file.name}`);
        const { jsonResponses, pageData, allRequests } = await processWACZ(file);
        console.log(`Found ${jsonResponses.length} JSON responses, ${pageData.length} pages, and ${allRequests.length} total requests in ${file.name}`);
        jsonFiles.push(...jsonResponses);
        pages.push(...pageData);
        debugLogs.push(...allRequests);
      } else {
        console.warn(`Unsupported file type: ${file.name}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }
  
  console.log(`Total JSON responses found: ${jsonFiles.length}`);
  console.log(`Total pages found: ${pages.length}`);
  console.log(`Total requests logged: ${debugLogs.length}`);
  
  return { jsonFiles, pages, debugLogs };
}

async function processWARC(file) {
  const jsonResponses = [];
  const allRequests = [];
  
  try {
    console.log(`Processing WARC file: ${file.name}`);
    
    // Create a proper stream from the file for WARCParser
    const fileStream = file.stream ? file.stream() : new Response(file).body;
    
    const parser = new WARCParser(fileStream);
    
    for await (const record of parser) {
      // Debug the record structure
      console.log('Record type:', record.warcType);
      console.log('Record structure:', Object.keys(record));
      
      // Look for response records
      if (record.warcType === 'response') {
        // Get content-type header using direct object access
        let contentType = null;
        
        try {
          // Access httpHeaders directly as an object
          if (record.httpHeaders && record.httpHeaders['content-type']) {
            contentType = record.httpHeaders['content-type'];
          }
        } catch (e) {
          console.error('Error accessing content-type:', e);
        }
                
        // Add to all requests log
        allRequests.push({
          url: record.warcTargetURI,
          method: 'GET', // Default, WARC doesn't always specify
          status: '200', // Default
          contentType: contentType || 'unknown',
          isJson: false, // Will be set to true if it's JSON
          pageUrl: 'WARC File' // No page association in WARC
        });
        
        try {
          // Get the content regardless of content type
          const content = await record.contentText();
          
          // Try to parse as JSON if it looks like JSON or starts with { or [
          if (content && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
            try {
              const jsonContent = JSON.parse(content);
              
              // Update the last added request to mark it as JSON
              if (allRequests.length > 0) {
                allRequests[allRequests.length - 1].isJson = true;
              }
              
              // Extract URL parts for better organization
              let url;
              try {
                url = new URL(record.warcTargetURI);
              } catch (e) {
                url = { hostname: 'unknown', pathname: record.warcTargetURI };
              }
              
              // Add to our results
              jsonResponses.push({
                id: record.warcRecordId || `record-${jsonResponses.length}`,
                path: record.warcTargetURI,
                pathname: url.pathname,
                hostname: url.hostname,
                page: url.hostname,
                method: 'GET',  // Default
                status: '200',  // Default
                content: jsonContent,
                timestamp: record.warcDate || new Date().toISOString(),
                type: 'api_response',
                contentType: contentType || 'application/json'
              });
            } catch (e) {
              // If it's not valid JSON, log and skip this record
              console.log(`Not valid JSON from ${record.warcTargetURI}: ${e.message}`);
            }
          }
        } catch (e) {
          console.error(`Error processing response from ${record.warcTargetURI}:`, e);
        }
      }
    }
    
    console.log(`Found ${jsonResponses.length} JSON responses in ${file.name}`);
  } catch (e) {
    console.error(`Error processing WARC file ${file.name}:`, e);
  }
  
  return { jsonResponses, allRequests };
}

// Helper function to read a file as ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

async function processWACZ(file) {
  const jsonResponses = [];
  const pageData = [];
  const allRequests = [];
  
  try {
    console.log(`Processing WACZ file: ${file.name}`);
    
    // Read the file as ArrayBuffer first
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Read the WACZ file as a zip
    const zipData = await JSZip.loadAsync(arrayBuffer);
    
    // Look for WARC files in the archive
    const warcFiles = Object.keys(zipData.files).filter(
      filename => filename.endsWith('.warc') || filename.endsWith('.warc.gz')
    );
    
    console.log(`Found ${warcFiles.length} WARC files in WACZ archive`);
    
    // Process each WARC file
    for (const warcFilename of warcFiles) {
      console.log(`Processing WARC file from WACZ: ${warcFilename}`);
      
      // Get the WARC file as a blob
      const warcBlob = await zipData.files[warcFilename].async('blob');
      
      // Create a stream from the blob
      const warcStream = warcBlob.stream();
      
      // Process the WARC file using the stream
      try {
        const parser = new WARCParser(warcStream);
        
        for await (const record of parser) {
          // Look for response records
          if (record.warcType === 'response') {
            // Get content-type header using direct object access
            let contentType = null;
            
            try {
              // Access httpHeaders directly as an object
              if (record.httpHeaders && record.httpHeaders['content-type']) {
                contentType = record.httpHeaders['content-type'];
              }
            } catch (e) {
              console.error('Error accessing content-type:', e);
            }
            
            // Add to all requests log
            allRequests.push({
              url: record.warcTargetURI,
              method: 'GET', // Default, WARC doesn't always specify
              status: '200', // Default
              contentType: contentType || 'unknown',
              isJson: false, // Will be set to true if it's JSON
              pageUrl: 'WARC File' // No page association in WARC
            });
            
            try {
              // Get the content regardless of content type
              const content = await record.contentText();
              
              // Try to parse as JSON if it looks like JSON or starts with { or [
              if (content && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
                try {
                  const jsonContent = JSON.parse(content);
                  
                  // Update the last added request to mark it as JSON
                  if (allRequests.length > 0) {
                    allRequests[allRequests.length - 1].isJson = true;
                  }
                  
                  // Extract URL parts for better organization
                  let url;
                  try {
                    url = new URL(record.warcTargetURI);
                  } catch (e) {
                    url = { hostname: 'unknown', pathname: record.warcTargetURI };
                  }
                  
                  // Add to our results
                  jsonResponses.push({
                    id: record.warcRecordId || `record-${jsonResponses.length}`,
                    path: record.warcTargetURI,
                    pathname: url.pathname,
                    hostname: url.hostname,
                    page: url.hostname,
                    method: 'GET',  // Default
                    status: '200',  // Default
                    content: jsonContent,
                    timestamp: record.warcDate || new Date().toISOString(),
                    type: 'api_response',
                    contentType: contentType || 'application/json'
                  });
                } catch (e) {
                  // If it's not valid JSON, log and skip this record
                  console.log(`Not valid JSON from ${record.warcTargetURI}: ${e.message}`);
                }
              }
            } catch (e) {
              console.error(`Error processing response from ${record.warcTargetURI}:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`Error processing WARC file ${warcFilename} from WACZ:`, e);
      }
    }
    
    // Look for pages.jsonl file
    if (zipData.files['pages/pages.jsonl']) {
      console.log('Found pages.jsonl file in WACZ archive');
      
      try {
        // Get the pages.jsonl file as text
        const pagesText = await zipData.files['pages/pages.jsonl'].async('text');
        
        // Split by lines and process each line
        const pagesLines = pagesText.split('\n').filter(line => line.trim());
        
        console.log(`Found ${pagesLines.length} pages in pages.jsonl`);
        
        // Process each page
        for (const pageLine of pagesLines) {
          try {
            // Parse the JSON line
            const pageInfo = JSON.parse(pageLine);
            
            // Extract the page URL
            const pageUrl = pageInfo.url || 'unknown';
            
            const pageId = pageInfo.id || `page-${pageData.length}`;
            // Add to our page data
            pageData.push({
              id: pageId,
              url: pageUrl,
              title: pageInfo.title || '',
              timestamp: pageInfo.ts || new Date().toISOString()
            });
            
            // Check if this page has recorded requests
            if (pageInfo.requests && Array.isArray(pageInfo.requests)) {
              console.log(`Found ${pageInfo.requests.length} requests in page ${pageUrl}`);
              
              // Look for requests with potential JSON responses
              for (let i = 0; i < pageInfo.requests.length; i++) {
                const request = pageInfo.requests[i];
                
                if (request.url) {
                  try {
                    // Get content type from response headers or request properties
                    let contentType = '';
                    if (request.responseHeaders && request.responseHeaders['content-type']) {
                      contentType = request.responseHeaders['content-type'];
                    } else if (request.contentType) {
                      contentType = request.contentType;
                    }
                    
                    // Log the content type for debugging
                    if (contentType) {
                      console.log(`Request ${request.url} has content-type: ${contentType}`);
                    }
                    
                    // Add to all requests log regardless of content type
                    allRequests.push({
                      url: request.url,
                      method: request.method || 'GET',
                      status: request.status || '200',
                      contentType: contentType || 'unknown',
                      isJson: false, // Will be set to true if it's JSON
                      parentPageUrl: pageUrl,
                      parentPageId: pageId
                    });
                    
                    // Check if this is likely JSON based on content type
                    const isLikelyJson = contentType && 
                        (contentType.toLowerCase().includes('json') || 
                         contentType.toLowerCase().includes('javascript'));
                    
                    // Try to parse the response as JSON if it looks like JSON
                    const responseText = request.response;
                    if (responseText && 
                        (isLikelyJson || 
                         responseText.trim().startsWith('{') || 
                         responseText.trim().startsWith('['))) {
                      try {
                        const jsonContent = JSON.parse(responseText);
                        
                        // Update the last added request to mark it as JSON
                        if (allRequests.length > 0) {
                          allRequests[allRequests.length - 1].isJson = true;
                        }
                        
                        let requestUrl;
                        try {
                          requestUrl = new URL(request.url);
                        } catch (e) {
                          requestUrl = { hostname: 'unknown', pathname: request.url };
                        }
                        
                        jsonResponses.push({
                          id: `page-${pageData.length-1}-request-${i}`,
                          path: request.url,
                          pathname: requestUrl.pathname,
                          hostname: requestUrl.hostname,
                          page: pageUrl,
                          method: request.method || 'GET',
                          status: request.status || '200',
                          content: jsonContent,
                          timestamp: request.timestamp || pageInfo.ts || new Date().toISOString(),
                          type: 'api_response',
                          parentPageId: pageId,
                          contentType: contentType || 'application/json'
                        });
                      } catch (e) {
                        // Not JSON, log and skip this request
                        console.log(`Not valid JSON from ${request.url}: ${e.message}`);
                      }
                    } else if (request.url) {
                      // Log non-JSON requests too
                      console.log(`Non-JSON request: ${request.url} (${contentType || 'unknown content type'})`);
                    }
                  } catch (e) {
                    console.error(`Error processing request from pages.jsonl: ${request.url}`, e);
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error parsing page data from pages.jsonl:', e);
          }
        }
      } catch (e) {
        console.error('Error processing pages.jsonl:', e);
      }
    }
    
    // Also look for any .json files directly in the archive
    const jsonFilenames = Object.keys(zipData.files).filter(
      filename => filename.endsWith('.json') && 
                 !filename.includes('datapackage') && 
                 !filename.includes('digest') &&
                 !zipData.files[filename].dir
    );
    
    if (jsonFilenames.length > 0) {
      console.log(`Found ${jsonFilenames.length} JSON files in archive`);
      
      for (const jsonFilename of jsonFilenames) {
        try {
          console.log(`Processing JSON file: ${jsonFilename}`);
          const jsonText = await zipData.files[jsonFilename].async('text');
          
          try {
            const jsonContent = JSON.parse(jsonText);
            
            // Add to all requests log
            allRequests.push({
              url: jsonFilename,
              method: 'FILE',
              status: '200',
              contentType: 'application/json',
              isJson: true,
              pageUrl: 'Archive Files'
            });
            
            // Add this JSON file to our results
            jsonResponses.push({
              id: jsonFilename,
              path: jsonFilename,
              pathname: `/${jsonFilename}`,
              hostname: 'archive',
              page: 'archive',
              method: 'GET',
              status: '200',
              content: jsonContent,
              timestamp: new Date().toISOString(),
              type: 'json_file',
              contentType: 'application/json'
            });
          } catch (e) {
            console.error(`Error parsing JSON file ${jsonFilename}:`, e);
          }
        } catch (e) {
          console.error(`Error reading JSON file ${jsonFilename}:`, e);
        }
      }
    }
    
    console.log(`Total JSON responses found in WACZ: ${jsonResponses.length}`);
    console.log(`Total pages found in WACZ: ${pageData.length}`);
    console.log(`Total requests logged in WACZ: ${allRequests.length}`);
  } catch (e) {
    console.error(`Error processing WACZ file ${file.name}:`, e);
  }
  
  return { jsonResponses, pageData, allRequests };
}

export async function extractJsonContent(file) {
  return file.content;
}

export function generateCsvPreview(selectedFiles, jqPath) {
  const results = [];
  
  for (const file of selectedFiles) {
    try {
      // Apply the jq-style path to extract data
      const extractedData = applyJqPath(file.content, jqPath);
      
      // Prepare metadata for this request
      const metadata = {
        source: file.path,
        url: file.path,
        pathname: file.pathname || '',
        hostname: file.hostname || '',
        method: file.method || '',
        status: file.status || '',
        timestamp: file.timestamp,
        page: file.page || '',
        type: file.type || ''
      };
      
      if (Array.isArray(extractedData)) {
        // If result is an array, add each item as a row
        extractedData.forEach(item => {
          results.push({
            ...flattenObject(item),
            ...metadata
          });
        });
      } else {
        // If result is a single object, add it as a row
        results.push({
          ...flattenObject(extractedData),
          ...metadata
        });
      }
    } catch (e) {
      console.error(`Error extracting data from ${file.path}:`, e);
    }
  }
  
  return results;
}

function applyJqPath(json, path) {
  // Special case: if path is just ".", return the entire JSON object
  if (path === '.') return json;
  
  // If no path is provided, return the JSON as is
  if (!path) return json;
  
  try {
    // Use jq-web to properly parse and apply the JQ path
    // First, ensure the path starts with a dot if it doesn't already
    const jqPath = path.startsWith('.') ? path : `.${path}`;
    
    // Apply the JQ path to the JSON data
    const result = jq.json(json, jqPath);
    
    // Return the result
    return result;
  } catch (error) {
    console.error(`Error applying JQ path '${path}':`, error);
    // Fallback to our simple implementation if jq-web fails
    return fallbackJqPath(json, path);
  }
}

// A simple fallback implementation in case jq-web fails
function fallbackJqPath(json, path) {
  if (path === '.' || !path) return json;
  
  try {
    const segments = path.split('.');
    // Filter out empty segments that might result from paths like ".property" or "property."
    const filteredSegments = segments.filter(segment => segment !== '');
    
    // If after filtering we have no segments, return the entire JSON
    if (filteredSegments.length === 0) return json;
    
    let current = json;
    
    for (const segment of filteredSegments) {
      if (current === null || current === undefined) {
        console.warn(`Path segment '${segment}' applied to null or undefined value`);
        return null;
      }
      
      // Handle array indices (convert string numbers to actual indices)
      if (/^\d+$/.test(segment)) {
        const index = parseInt(segment, 10);
        if (!Array.isArray(current)) {
          console.warn(`Attempted to access index ${index} of non-array:`, current);
          return null;
        }
        if (index >= current.length) {
          console.warn(`Array index ${index} out of bounds (length: ${current.length})`);
          return null;
        }
        current = current[index];
      } else {
        // Handle object properties
        if (typeof current !== 'object' || current === null) {
          console.warn(`Attempted to access property '${segment}' of non-object:`, current);
          return null;
        }
        if (!(segment in current)) {
          console.warn(`Property '${segment}' not found in object:`, current);
          return null;
        }
        current = current[segment];
      }
    }
    
    return current;
  } catch (error) {
    console.error(`Error applying fallback JQ path '${path}':`, error);
    return null;
  }
}

function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  if (!obj || typeof obj !== 'object') {
    return { value: obj };
  }
  
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(flattened, flattenObject(obj[key], `${prefix}${key}.`));
    } else {
      flattened[`${prefix}${key}`] = obj[key];
    }
  }
  
  return flattened;
}

export function exportToCsv(data) {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      // Handle values that need to be quoted (contain commas, quotes, or newlines)
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  // Create a more descriptive filename with date
  const date = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `api_data_extract_${date}.csv`);
  
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 