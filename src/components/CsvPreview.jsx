import React from 'react';
import './CsvPreview.css';

const CsvPreview = ({ data, onExport }) => {
  if (!data || data.length === 0) {
    return (
      <div className="csv-preview">
        <div className="csv-preview-header">
          <div className="header-title">
            <h2>CSV Preview</h2>
          </div>
        </div>
        <div className="empty-state">
          <p className="empty-message">
            {data && data.length === 0 ? 
              'No data found for the selected path. Try selecting a different path or check the console for errors.' :
              'Select JSON files and a path to see a preview of the extracted data'}
          </p>
        </div>
      </div>
    );
  }

  const headers = Object.keys(data[0]);

  // Determine column size based on header name
  const getColumnSizeClass = (header) => {
    const name = header.toLowerCase();
    
    // Small columns for IDs, status codes, etc.
    if (name === 'id' || name === 'status' || name === 'method' || 
        name.includes('code') || name.includes('count')) {
      return 'col-xs';
    }
    
    // Medium columns for dates, URLs, etc.
    if (name.includes('date') || name.includes('time') || 
        name === 'url' || name === 'path' || name === 'hostname') {
      return 'col-md';
    }
    
    // Large columns for descriptions, titles, etc.
    if (name.includes('description') || name.includes('title') || 
        name.includes('name') || name.includes('text')) {
      return 'col-lg';
    }
    
    // Extra large columns for content, source, etc.
    if (name === 'source' || name === 'content' || name === 'response' || 
        name.includes('data') || name.includes('json')) {
      return 'col-xl';
    }
    
    // Default to small-medium size
    return 'col-sm';
  };

  // Determine which columns might contain long content (like JSON)
  const isContentColumn = (header) => {
    const name = header.toLowerCase();
    return name === 'source' || 
           name === 'content' || 
           name === 'json' ||
           name.includes('data') ||
           name === 'response';
  };

  // Determine which columns might contain extra-long content
  const isExtraLongColumn = (header) => {
    const name = header.toLowerCase();
    return name === 'source' || 
           name === 'content' ||
           name === 'response';
  };

  // Get CSS class for a cell based on its header
  const getCellClass = (header) => {
    const sizeClass = getColumnSizeClass(header);
    
    if (!isContentColumn(header)) {
      return sizeClass;
    }
    
    return isExtraLongColumn(header) 
      ? `${sizeClass} content-cell extra-long` 
      : `${sizeClass} content-cell`;
  };

  // Format cell content based on type and length
  const formatCellContent = (content, header) => {
    if (content === undefined || content === null) {
      return '';
    }
    
    const stringContent = String(content);
    
    // If it's a JSON string, try to extract just a summary
    if (isContentColumn(header) && stringContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(stringContent);
        
        // For JSON objects, just show a summary instead of the full content
        if (typeof parsed === 'object' && parsed !== null) {
          const keys = Object.keys(parsed);
          if (keys.length === 0) return '{}';
          
          // Just show the keys that exist in the object
          return `{${keys.slice(0, 2).join(', ')}${keys.length > 2 ? '...' : ''}}`;
        }
        
        return stringContent;
      } catch (e) {
        // If parsing fails, just return the original string
        return stringContent;
      }
    }
    
    return stringContent;
  };

  // Simplify complex objects for preview by limiting depth and array length
  const simplifyObject = (obj, depth = 0, maxDepth = 1, maxArrayItems = 2) => {
    if (depth > maxDepth) {
      return typeof obj === 'object' && obj !== null 
        ? Array.isArray(obj) 
          ? `[Array(${obj.length})]` 
          : '{...}'
        : obj;
    }
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return [];
      
      const preview = obj.slice(0, maxArrayItems).map(item => 
        simplifyObject(item, depth + 1, maxDepth, maxArrayItems)
      );
      
      if (obj.length > maxArrayItems) {
        preview.push(`+${obj.length - maxArrayItems}`);
      }
      
      return preview;
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      const keys = Object.keys(obj);
      
      if (keys.length === 0) return {};
      
      // Take only the first few keys for preview
      const previewKeys = keys.slice(0, maxArrayItems);
      
      previewKeys.forEach(key => {
        result[key] = simplifyObject(obj[key], depth + 1, maxDepth, maxArrayItems);
      });
      
      if (keys.length > maxArrayItems) {
        result[`+${keys.length - maxArrayItems}`] = '...';
      }
      
      return result;
    }
    
    return obj;
  };

  // Truncate very long text for display
  const truncateForDisplay = (text, maxLength = 100) => {
    if (!text) return '';
    
    const stringText = String(text);
    if (stringText.length <= maxLength) return stringText;
    
    // For very long text, just show the beginning with an indicator
    const beginning = stringText.substring(0, maxLength - 20);
    
    return `${beginning}... [+${stringText.length - maxLength}]`;
  };

  return (
    <div className="csv-preview">
      <div className="csv-preview-header">
        <div className="header-title">
          <h2>CSV Preview {data.length > 0 && <span className="row-count-badge">({data.length} rows)</span>}</h2>
        </div>
        <button 
          className="export-button" 
          onClick={onExport}
          disabled={data.length === 0}
        >
          Export CSV
        </button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {headers.map(header => (
                <th key={header} className={getColumnSizeClass(header)}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((row, index) => (
              <tr key={index}>
                {headers.map(header => (
                  <td 
                    key={`${index}-${header}`}
                    className={getCellClass(header)}
                  >
                    {truncateForDisplay(formatCellContent(row[header], header))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 5 && (
          <div className="more-rows">
            +{data.length - 5} more rows
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvPreview; 