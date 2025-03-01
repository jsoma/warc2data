import React, { useEffect, useRef } from 'react';
import ReactJson from 'react-json-view';
import './JsonViewer.css';

const JsonViewer = ({ jsonContent, onPathSelect }) => {
  const jsonViewerRef = useRef(null);

  // Set up click handlers for JSON fields
  useEffect(() => {
    if (!jsonViewerRef.current) return;

    const container = jsonViewerRef.current;
    
    // Function to extract the full path when a key is clicked
    const handleClick = (e) => {
      // Only process clicks on object keys or values
      if (!e.target.closest('.variable-row')) return;
      
      // Check if we clicked on an object key
      const objectKey = e.target.closest('.object-key');
      if (!objectKey) return;
      
      // Get the key name without quotes and colon
      let keyName = objectKey.textContent.replace(':', '').trim();
      if ((keyName.startsWith('"') && keyName.endsWith('"')) || 
          (keyName.startsWith("'") && keyName.endsWith("'"))) {
        keyName = keyName.substring(1, keyName.length - 1);
      }
      
      // Find the variable row that contains this key
      const variableRow = objectKey.closest('.variable-row');
      if (!variableRow) return;
      
      // Build the path by traversing up the DOM
      const path = [keyName];
      
      // Find all parent objects by looking for object-container elements
      let currentElement = variableRow.parentElement;
      
      while (currentElement) {
        // Find the closest parent variable-row
        const parentRow = currentElement.closest('.variable-row');
        if (!parentRow) break;
        
        // Get the key from the parent row
        const parentKey = parentRow.querySelector('.object-key');
        if (parentKey) {
          let parentKeyName = parentKey.textContent.replace(':', '').trim();
          if ((parentKeyName.startsWith('"') && parentKeyName.endsWith('"')) || 
              (parentKeyName.startsWith("'") && parentKeyName.endsWith("'"))) {
            parentKeyName = parentKeyName.substring(1, parentKeyName.length - 1);
          }
          
          // Add this key to the beginning of our path
          path.unshift(parentKeyName);
        }
        
        // Move up to the next level
        currentElement = parentRow.parentElement;
      }
      
      // Join the path parts with dots
      const fullPath = path.join('.');
      console.log('Selected path:', fullPath);
      onPathSelect(fullPath);
    };
    
    // Add the click event listener
    container.addEventListener('click', handleClick);
    
    // Clean up the event listener when the component unmounts
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [jsonContent, onPathSelect]);

  return (
    <div className="json-viewer">
      <h2>JSON Content <span className="help-text">(Click on a field to select its path)</span></h2>
      <div className="json-content" ref={jsonViewerRef}>
        {jsonContent ? (
          <ReactJson 
            src={jsonContent} 
            theme="monokai" 
            collapsed={1}
            displayDataTypes={false}
            onSelect={() => false} // Disable the default onSelect behavior
            onAdd={false}
            onEdit={false}
            onDelete={false}
            enableClipboard={false}
            displayObjectSize={true}
            name={null}
            shouldCollapse={false}
          />
        ) : (
          <p className="empty-message">Select a JSON file to view its content</p>
        )}
      </div>
    </div>
  );
};

export default JsonViewer; 