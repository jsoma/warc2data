import { WARCParser } from 'warcio';
import JSZip from 'jszip';

export async function processArchiveFiles(files) {
  const jsonFiles = [];
  const pages = [];
  
  console.log(`Processing ${files.length} archive files`);
  
  for (const file of files) {
    try {
      if (file.name.endsWith('.warc') || file.name.endsWith('.warc.gz')) {
        console.log(`Processing WARC file: ${file.name}`);
        const { jsonResponses } = await processWARC(file);
        console.log(`Found ${jsonResponses.length} JSON responses in ${file.name}`);
        jsonFiles.push(...jsonResponses);
      } else if (file.name.endsWith('.wacz')) {
        console.log(`Processing WACZ file: ${file.name}`);
        const { jsonResponses, pageData } = await processWACZ(file);
        console.log(`Found ${jsonResponses.length} JSON responses and ${pageData.length} pages in ${file.name}`);
        jsonFiles.push(...jsonResponses);
        pages.push(...pageData);
      } else {
        console.warn(`Unsupported file type: ${file.name}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }
  
  console.log(`Total JSON responses found: ${jsonFiles.length}`);
  console.log(`Total pages found: ${pages.length}`);
  
  return { jsonFiles, pages };
}

async function processWARC(file) {
  const jsonResponses = [];
  
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
        
        // Debug log to see what content types we're finding
        if (contentType) {
          console.log(`Found response with content-type: ${contentType} for ${record.warcTargetURI}`);
        } else {
          console.log(`No content-type found for ${record.warcTargetURI}`);
        }
        
        try {
          // Get the content regardless of content type
          const content = await record.contentText();
          
          // Try to parse as JSON if it looks like JSON or starts with { or [
          if (content && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
            try {
              console.log(`Attempting to parse as JSON: ${record.warcTargetURI}`);
              const jsonContent = JSON.parse(content);
              console.log(`Successfully parsed JSON from ${record.warcTargetURI}`);
              
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
  
  return { jsonResponses };
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
  
  try {
    console.log(`Processing WACZ file: ${file.name}`);
    
    // Convert the file to ArrayBuffer first
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Read the WACZ file as a zip
    const zipData = await JSZip.loadAsync(arrayBuffer);
    
    // Process WARC files inside the WACZ
    const warcFilenames = Object.keys(zipData.files).filter(
      filename => (filename.endsWith('.warc') || filename.endsWith('.warc.gz')) && !zipData.files[filename].dir
    );
    
    console.log(`Found ${warcFilenames.length} WARC files in WACZ archive`);
    
    for (const warcFilename of warcFilenames) {
      try {
        console.log(`Extracting WARC file from WACZ: ${warcFilename}`);
        const warcBlob = await zipData.files[warcFilename].async('blob');
        // Create a File object from the Blob
        const warcFile = new File([warcBlob], warcFilename, { type: 'application/warc' });
        
        // Create a proper stream for the WARCParser
        const warcStream = warcFile.stream ? warcFile.stream() : new Response(warcFile).body;
        
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
              
              // Debug log to see what content types we're finding
              if (contentType) {
                console.log(`Found response with content-type: ${contentType} for ${record.warcTargetURI}`);
              } else {
                console.log(`No content-type found for ${record.warcTargetURI}`);
              }
              
              try {
                // Get the content regardless of content type
                const content = await record.contentText();
                
                // Try to parse as JSON if it looks like JSON or starts with { or [
                if (content && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
                  try {
                    console.log(`Attempting to parse as JSON: ${record.warcTargetURI}`);
                    const jsonContent = JSON.parse(content);
                    console.log(`Successfully parsed JSON from ${record.warcTargetURI}`);
                    
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
          console.error(`Error parsing WARC file ${warcFilename} from WACZ:`, e);
        }
      } catch (e) {
        console.error(`Error extracting WARC file ${warcFilename} from WACZ:`, e);
      }
    }
    
    // Always check pages.jsonl for additional API requests and page data
    console.log("Checking pages.jsonl for pages and API requests");
    
    // Check for pages.jsonl which might contain API requests
    if (zipData.files['pages/pages.jsonl'] || zipData.files['pages.jsonl']) {
      const pagesFile = zipData.files['pages/pages.jsonl'] || zipData.files['pages.jsonl'];
      try {
        console.log('Processing pages.jsonl file');
        const pagesText = await pagesFile.async('text');
        const pagesLines = pagesText.split('\n').filter(line => line.trim());
        
        console.log(`Found ${pagesLines.length} entries in pages.jsonl`);
        
        for (const line of pagesLines) {
          try {
            const pageInfo = JSON.parse(line);
            
            // Extract page URL
            const pageUrl = pageInfo.url || 'unknown-url';
            let url;
            try {
              url = new URL(pageUrl);
            } catch (e) {
              url = { hostname: 'unknown', pathname: pageUrl };
            }
            
            // Add page to the pages array
            pageData.push({
              id: pageInfo.id || `page-${pageData.length}`,
              url: pageUrl,
              title: pageInfo.title || '',
              timestamp: pageInfo.ts || new Date().toISOString(),
              hostname: url.hostname,
              pathname: url.pathname
            });
            
            // Check if this page has recorded requests
            if (pageInfo.requests && Array.isArray(pageInfo.requests)) {
              console.log(`Found ${pageInfo.requests.length} requests in page ${pageUrl}`);
              
              // Look for requests with potential JSON responses
              for (let i = 0; i < pageInfo.requests.length; i++) {
                const request = pageInfo.requests[i];
                
                if (request.url && request.response) {
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
                        console.log(`Attempting to parse as JSON: ${request.url}`);
                        const jsonContent = JSON.parse(responseText);
                        console.log(`Successfully parsed JSON from ${request.url}`);
                        
                        let requestUrl;
                        try {
                          requestUrl = new URL(request.url);
                        } catch (e) {
                          requestUrl = { hostname: 'unknown', pathname: request.url };
                        }
                        
                        jsonResponses.push({
                          id: `page-${pageData.id || ''}-request-${i}`,
                          path: request.url,
                          pathname: requestUrl.pathname,
                          hostname: requestUrl.hostname,
                          page: url.hostname,
                          method: request.method || 'GET',
                          status: request.status || '200',
                          content: jsonContent,
                          timestamp: request.timestamp || pageInfo.ts || new Date().toISOString(),
                          type: 'api_response',
                          parentPageUrl: pageUrl,
                          contentType: contentType || 'application/json'
                        });
                      } catch (e) {
                        // Not JSON, log and skip this request
                        console.log(`Not valid JSON from ${request.url}: ${e.message}`);
                      }
                    }
                  } catch (e) {
                    console.error(`Error processing request from pages.jsonl: ${request.url}`, e);
                  }
                }
              }
            } else {
              console.log(`No requests found in page ${pageUrl}`);
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
  } catch (e) {
    console.error(`Error processing WACZ file ${file.name}:`, e);
  }
  
  return { jsonResponses, pageData };
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
  if (!path) return json;
  
  try {
    const segments = path.split('.');
    let current = json;
    
    for (const segment of segments) {
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
    console.error(`Error applying JQ path '${path}':`, error);
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